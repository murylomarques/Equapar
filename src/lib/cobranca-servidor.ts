import "server-only";
import type { Plano } from "@prisma/client";
import { db } from "./db";
import { aplicarEvento, type Ciclo, type EventoPagamento, type SituacaoCobranca, valorDoPlano } from "./planos";
import { cobranca, type Metodo } from "./cobranca";
import { appUrl, enviar } from "./mensagens";
import { reais } from "./format";

/**
 * Fase 1 (4.2). Abre a cobrança do plano escolhido. O plano NÃO muda aqui: fica em planoPendente e passa
 * a valer quando o pagamento for confirmado (webhook do Asaas ou simulação).
 */
export async function abrirCobrancaDoPlano(contaId: string, plano: Plano, ciclo: Ciclo, metodo: Metodo | "ESCOLHER", email: string) {
  const conta = await db.conta.findUniqueOrThrow({ where: { id: contaId }, include: { empresas: { take: 1, orderBy: { criadoEm: "asc" } } } });
  const agg = await db.contrato.aggregate({ where: { arquivado: false, maoDeObraDedicada: true, empresa: { contaId } }, _sum: { postos: true } });
  const valor = valorDoPlano(plano, { postos: agg._sum.postos ?? 0, ciclo });
  const hoje = new Date();
  const vencimento = new Date(hoje.getTime() + 3 * 86_400_000);
  const fatura = await db.fatura.create({
    data: {
      contaId,
      referencia: hoje.toISOString().slice(0, 7),
      descricao: `Plano ${plano.toLowerCase()} (${ciclo === "ANUAL" ? "anual" : "mensal"})`,
      valor: valor.toFixed(2),
      postos: agg._sum.postos ?? null,
      vencimento,
      metodo: metodo === "ESCOLHER" ? null : metodo,
    },
  });
  const g = cobranca();
  const clienteId = await g.garantirCliente({ contaId, nome: conta.empresas[0]?.razaoSocial ?? conta.nome, cpfCnpj: conta.empresas[0]?.cnpj ?? "", email, clienteIdAtual: conta.gatewayClienteId });
  const c = await g.criarCobranca({ clienteId, valor: valor.toFixed(2), vencimento: vencimento.toISOString().slice(0, 10), descricao: fatura.descricao, referenciaExterna: fatura.id, metodo });
  await db.fatura.update({ where: { id: fatura.id }, data: { gatewayId: c.id, linkPagamento: c.link } });
  await db.conta.update({ where: { id: contaId }, data: { planoPendente: plano, ciclo, gatewayClienteId: clienteId } });
  return { faturaId: fatura.id, link: c.link, valor: valor.toFixed(2), modo: g.modo };
}

/**
 * Processa um evento de pagamento (webhook ou simulação). Com `eventoId`, cada evento vale uma vez só.
 * Nunca apaga dados: no pior caso, a conta fica somente leitura depois da carência.
 */
export async function processarEventoPagamento(opts: { faturaId?: string; gatewayId?: string; evento: EventoPagamento; eventoId?: string; tipoOriginal?: string }) {
  if (opts.eventoId) {
    const ja = await db.eventoCobranca.findUnique({ where: { id: opts.eventoId } });
    if (ja) return "repetido" as const;
  }
  const f = await db.fatura.findFirst({ where: opts.faturaId ? { id: opts.faturaId } : { gatewayId: opts.gatewayId }, include: { conta: true } });
  if (!f) return "fatura-nao-encontrada" as const;
  const r = aplicarEvento({ faturaStatus: f.status, tentativas: f.tentativas, situacao: f.conta.situacaoCobranca as SituacaoCobranca, carenciaAte: f.conta.carenciaAte }, opts.evento);
  await db.$transaction(async (tx) => {
    if (opts.eventoId) await tx.eventoCobranca.create({ data: { id: opts.eventoId, tipo: opts.tipoOriginal ?? opts.evento } });
    await tx.fatura.update({ where: { id: f.id }, data: { ...r.fatura, ...(opts.evento === "PAGO" ? { pagaEm: new Date() } : {}), ...(r.novaTentativaEm ? { vencimento: r.novaTentativaEm } : {}) } });
    if (r.conta || r.aplicarPlano)
      await tx.conta.update({
        where: { id: f.contaId },
        data: {
          ...(r.conta ? { situacaoCobranca: r.conta.situacao, carenciaAte: r.conta.carenciaAte } : {}),
          ...(r.aplicarPlano && f.conta.planoPendente ? { plano: f.conta.planoPendente, planoPendente: null, ...(f.conta.planoPendente === "PILOTO" ? { pilotoInicio: new Date() } : {}) } : {}),
        },
      });
  });
  if (r.avisar) await avisarDonos(f.contaId, r.avisar, f.valor.toString(), f.linkPagamento, r.conta?.carenciaAte ?? null);
  return "processado" as const;
}

async function avisarDonos(contaId: string, tipo: "pago" | "atrasada" | "carencia", valor: string, link: string | null, carenciaAte: Date | null) {
  const donos = await db.membro.findMany({ where: { contaId, papel: "DONO" }, include: { usuario: true } });
  const texto = {
    pago: `Recebemos o pagamento de ${reais(valor)}. Obrigado!`,
    atrasada: `O pagamento de ${reais(valor)} não foi identificado. Tentaremos de novo em 5 dias. Para pagar agora: ${link ?? appUrl("/app/configuracoes?aba=cobranca")}`,
    carencia: `Depois de 3 tentativas, o pagamento de ${reais(valor)} não foi identificado. A conta continua funcionando até ${carenciaAte?.toLocaleDateString("pt-BR", { timeZone: "UTC" })}; depois, fica só para consulta (nenhum dado é apagado). Para regularizar: ${appUrl("/app/configuracoes?aba=cobranca")}`,
  }[tipo];
  for (const d of donos)
    await enviar({ contaId, chave: `COBRANCA:${tipo}:${contaId}:${Date.now()}`, tipo: "COBRANCA", canal: "EMAIL", destino: d.usuario.email, assunto: "Equapar: cobrança", corpo: texto });
}
