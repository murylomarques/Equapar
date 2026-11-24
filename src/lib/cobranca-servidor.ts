import "server-only";
import { Prisma, type Plano } from "@prisma/client";
import Decimal from "decimal.js";
import { db } from "./db";
import { aplicarEvento, type Ciclo, type SituacaoCobranca, valorDoPlano } from "./planos";
import { cobranca, type Metodo } from "./cobranca";
import { appUrl, enviar } from "./mensagens";
import { reais } from "./format";
import { faturaCancelavel, faturaDevida, fimDoPeriodo, planoEfetivo, transicao, type EventoGateway, type FaturaRegra } from "./assinatura";
import { registrar } from "./registro";
import { registrarEvento } from "./eventos";

type Tx = Prisma.TransactionClient;

/** Dias antes do fim do período em que a renovação é gerada. */
export const RENOVAR_DIAS_ANTES = 7;

const regra = (f: { status: string; valor: Prisma.Decimal; valorEstornado: Prisma.Decimal; periodoInicio: Date | null; periodoFim: Date | null; ciclo: string | null; plano: Plano | null; revisao: string | null }): FaturaRegra => ({
  status: f.status,
  valor: f.valor.toString(),
  valorEstornado: f.valorEstornado.toString(),
  periodoInicio: f.periodoInicio,
  periodoFim: f.periodoFim,
  ciclo: f.ciclo,
  plano: f.plano,
  revisao: f.revisao,
});

async function postosCobrados(tx: Tx | typeof db, contaId: string) {
  const agg = await tx.contrato.aggregate({ where: { arquivado: false, maoDeObraDedicada: true, empresa: { contaId } }, _sum: { postos: true } });
  return agg._sum.postos ?? 0;
}

/**
 * Recalcula o plano efetivo da conta a partir das faturas (dentro da transação do chamador).
 * Conta no Grátis sem fatura devida em aberto nunca fica em atraso nem somente leitura.
 */
export async function sincronizarPlano(tx: Tx, contaId: string, agora = new Date()) {
  const conta = await tx.conta.findUniqueOrThrow({ where: { id: contaId } });
  const faturas = await tx.fatura.findMany({ where: { contaId } });
  const r = planoEfetivo(
    { plano: conta.plano, planoVigenteAte: conta.planoVigenteAte, renovacaoCancelada: conta.renovacaoCancelada, mudancaAgendada: conta.mudancaAgendada, mudancaAgendadaEm: conta.mudancaAgendadaEm },
    faturas.map(regra),
    agora,
  );
  const devidas = faturas.filter((f) => faturaDevida(regra(f), agora));
  const semDivida = devidas.length === 0;
  const data: Prisma.ContaUpdateInput = {
    plano: r.plano,
    planoVigenteAte: r.planoVigenteAte,
    // o ciclo da renovação acompanha o período pago em vigor (salvo troca de ciclo já agendada)
    ...(r.ciclo && !conta.mudancaAgendada ? { ciclo: r.ciclo } : {}),
    ...(r.limparAgendamento ? { mudancaAgendada: null, mudancaAgendadaEm: null } : {}),
    ...(semDivida && conta.situacaoCobranca !== "EM_DIA" ? { situacaoCobranca: "EM_DIA", carenciaAte: null } : {}),
  };
  await tx.conta.update({ where: { id: contaId }, data });
  return r;
}

/** Cancela no gateway e na Equapar as faturas em aberto que ainda não começaram (deixaram de ser devidas). */
async function cancelarNaoIniciadas(contaId: string, motivo: string, agora: Date, filtro?: (f: { plano: Plano | null; renovacao: boolean }) => boolean) {
  const abertas = await db.fatura.findMany({ where: { contaId, status: { in: ["ABERTA", "FALHOU"] } } });
  const alvo = abertas.filter((f) => faturaCancelavel(regra(f), agora) && (!filtro || filtro(f)));
  const g = cobranca();
  for (const f of alvo) {
    // primeiro marca aqui (um PAGO que chegar depois cai em "pago depois do cancelamento" e não reativa nada)
    const n = await db.fatura.updateMany({ where: { id: f.id, status: { in: ["ABERTA", "FALHOU"] } }, data: { status: "CANCELADA", canceladaEm: agora, motivoCancelamento: motivo } });
    if (n.count && f.gatewayId) {
      try {
        await g.cancelarCobranca(f.gatewayId);
      } catch (e) {
        // a fatura já não é devida aqui; o gateway é reconciliado pelo webhook (PAYMENT_DELETED) ou à mão
        registrar("erro", "cancelar_cobranca_gateway", { faturaId: f.id, erro: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return alvo.length;
}

/**
 * Abre a cobrança de uma compra de plano. O plano NÃO muda aqui: a fatura diz o que compra e o acesso começa
 * quando o pagamento for confirmado. Cobranças de compra anteriores ainda não pagas são substituídas.
 */
export async function abrirCobrancaDoPlano(contaId: string, plano: Plano, ciclo: Ciclo, metodo: Metodo | "ESCOLHER", email: string, agora = new Date()) {
  const conta = await db.conta.findUniqueOrThrow({ where: { id: contaId }, include: { empresas: { take: 1, orderBy: { criadoEm: "asc" } } } });
  // Uma decisão por conta de cada vez (dois cliques, duas abas): sem isso, duas cobranças iguais podiam ser abertas e pagas.
  const d = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`compra:${contaId}`}))`;
    const abertas = await tx.fatura.findMany({ where: { contaId, status: { in: ["ABERTA", "FALHOU"] } } });
    // a mesma compra ainda pagável: devolve a mesma cobrança (idempotente)
    const igual = abertas.find((f) => !f.renovacao && f.status === "ABERTA" && f.plano === plano && f.ciclo === ciclo && faturaCancelavel(regra(f), agora) && (!f.vencimento || f.vencimento >= agora));
    if (igual) return { fatura: igual, cancelar: [] as { id: string; gatewayId: string | null }[] };
    // tudo que ainda não começou (compra anterior ou renovação futura) é substituído pela compra nova
    const cancelar = abertas.filter((f) => faturaCancelavel(regra(f), agora));
    if (cancelar.length)
      await tx.fatura.updateMany({ where: { id: { in: cancelar.map((f) => f.id) } }, data: { status: "CANCELADA", canceladaEm: agora, motivoCancelamento: "Substituída por outra escolha de plano" } });
    const postos = await postosCobrados(tx, contaId);
    const valor = valorDoPlano(plano, { postos, ciclo });
    const fatura = await tx.fatura.create({
      data: {
        contaId,
        referencia: agora.toISOString().slice(0, 7),
        descricao: `Plano ${plano.toLowerCase()} (${ciclo === "ANUAL" ? "anual" : "mensal"})`,
        valor: valor.toFixed(2),
        postos,
        vencimento: new Date(agora.getTime() + 3 * 86_400_000),
        metodo: metodo === "ESCOLHER" ? null : metodo,
        plano,
        ciclo,
      },
    });
    // a compra substitui qualquer downgrade agendado; planoPendente fica só para leitura das telas antigas
    await tx.conta.update({ where: { id: contaId }, data: { planoPendente: plano, ciclo, mudancaAgendada: null, mudancaAgendadaEm: null, renovacaoCancelada: false } });
    return { fatura, cancelar: cancelar.map((f) => ({ id: f.id, gatewayId: f.gatewayId })) };
  });
  const g = cobranca();
  await cancelarNoGateway(d.cancelar);
  if (d.fatura.gatewayId && d.fatura.linkPagamento) return { faturaId: d.fatura.id, link: d.fatura.linkPagamento, valor: d.fatura.valor.toFixed(2), modo: g.modo };
  // fatura nova (ou uma igual que ficou sem cobrança no gateway por falha anterior): cria a cobrança agora
  const clienteId = await g.garantirCliente({ contaId, nome: conta.empresas[0]?.razaoSocial ?? conta.nome, cpfCnpj: conta.empresas[0]?.cnpj ?? "", email, clienteIdAtual: conta.gatewayClienteId });
  const c = await g.criarCobranca({ clienteId, valor: d.fatura.valor.toFixed(2), vencimento: (d.fatura.vencimento ?? agora).toISOString().slice(0, 10), descricao: d.fatura.descricao, referenciaExterna: d.fatura.id, metodo });
  await db.fatura.update({ where: { id: d.fatura.id }, data: { gatewayId: c.id, linkPagamento: c.link } });
  await db.conta.update({ where: { id: contaId }, data: { gatewayClienteId: clienteId } });
  return { faturaId: d.fatura.id, link: c.link, valor: d.fatura.valor.toFixed(2), modo: g.modo };
}

/** Remove no gateway as cobranças já canceladas aqui. Falha no gateway não reabre nada (reconcilia pelo webhook ou à mão). */
async function cancelarNoGateway(faturas: { id: string; gatewayId: string | null }[]) {
  const g = cobranca();
  for (const f of faturas) {
    if (!f.gatewayId) continue;
    try {
      await g.cancelarCobranca(f.gatewayId);
    } catch (e) {
      registrar("erro", "cancelar_cobranca_gateway", { faturaId: f.id, erro: e instanceof Error ? e.message : String(e) });
    }
  }
}

/** Cancela a renovação: o acesso pago segue até o fim do período; cobranças futuras deixam de existir. */
export async function cancelarRenovacao(contaId: string, agora = new Date()) {
  const conta = await db.conta.findUniqueOrThrow({ where: { id: contaId } });
  const ativo = !!conta.planoVigenteAte && conta.planoVigenteAte > agora && conta.plano !== "GRATIS";
  const canceladas = await cancelarNaoIniciadas(contaId, "Cancelamento pedido pelo cliente", agora);
  await db.$transaction(async (tx) => {
    await tx.conta.update({
      where: { id: contaId },
      data: ativo
        ? { renovacaoCancelada: true, mudancaAgendada: "GRATIS", mudancaAgendadaEm: conta.planoVigenteAte, planoPendente: null }
        : { renovacaoCancelada: true, mudancaAgendada: null, mudancaAgendadaEm: null, planoPendente: null, ...(conta.plano !== "PILOTO" ? { plano: "GRATIS" } : {}) },
    });
    await sincronizarPlano(tx, contaId, agora);
  });
  return { agendado: ativo, ate: ativo ? conta.planoVigenteAte : null, canceladas };
}

/** Desfaz o cancelamento antes da data: a renovação volta a valer. Nada é cobrado agora. */
export async function reativarRenovacao(contaId: string) {
  await db.conta.update({ where: { id: contaId }, data: { renovacaoCancelada: false, mudancaAgendada: null, mudancaAgendadaEm: null } });
}

/** Downgrade entre planos pagos: vale na renovação. A renovação já gerada no plano antigo é substituída. */
export async function agendarMudanca(contaId: string, plano: Plano, agora = new Date()) {
  const conta = await db.conta.findUniqueOrThrow({ where: { id: contaId } });
  if (!conta.planoVigenteAte || conta.planoVigenteAte <= agora) throw new Error("Sem período pago em andamento para agendar a mudança.");
  await cancelarNaoIniciadas(contaId, `Renovação substituída pelo plano ${plano.toLowerCase()}`, agora, (f) => f.renovacao);
  await db.conta.update({ where: { id: contaId }, data: { mudancaAgendada: plano, mudancaAgendadaEm: conta.planoVigenteAte, renovacaoCancelada: false } });
  return conta.planoVigenteAte;
}

/**
 * Processa um evento de pagamento (webhook ou simulação), numa transação só:
 *  1. registra o id do evento (ON CONFLICT DO NOTHING): a mesma entrega repetida, mesmo simultânea, vale uma vez;
 *  2. trava a fatura (SELECT … FOR UPDATE): eventos diferentes da mesma fatura não se atropelam;
 *  3. aplica a transição (monotônica: evento fora de ordem não desfaz o que já aconteceu);
 *  4. recalcula o plano da conta pelos períodos pagos.
 * Nunca apaga dados: no pior caso, a conta fica somente leitura depois da carência.
 */
export async function processarEventoPagamento(opts: {
  faturaId?: string;
  gatewayId?: string;
  evento: EventoGateway;
  eventoId?: string;
  tipoOriginal?: string;
  dataEvento?: Date;
  valorEstornado?: string;
  agora?: Date;
}) {
  const agora = opts.agora ?? new Date();
  const r = await db.$transaction(
    async (tx) => {
      if (opts.eventoId) {
        const novo = await tx.eventoCobranca.createMany({
          data: [{ id: opts.eventoId, tipo: opts.tipoOriginal ?? opts.evento, gatewayId: opts.gatewayId ?? null, faturaId: opts.faturaId ?? null, dataEvento: opts.dataEvento ?? null }],
          skipDuplicates: true,
        });
        if (novo.count === 0) return { resultado: "repetido" as const };
      }
      // pelo id do gateway; se não achar, pela referência externa (id da fatura na Equapar)
      let travada: { id: string } | undefined;
      if (opts.gatewayId) travada = (await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Fatura" WHERE "gatewayId" = ${opts.gatewayId} FOR UPDATE`)[0];
      if (!travada && opts.faturaId) travada = (await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Fatura" WHERE id = ${opts.faturaId} FOR UPDATE`)[0];
      if (!travada) {
        if (opts.eventoId) await tx.eventoCobranca.update({ where: { id: opts.eventoId }, data: { resultado: "fatura-nao-encontrada" } });
        return { resultado: "fatura-nao-encontrada" as const };
      }
      const f = await tx.fatura.findUniqueOrThrow({ where: { id: travada.id }, include: { conta: true } });
      const t = transicao(regra(f), opts.evento, agora, { valorEstornado: opts.valorEstornado });
      let avisar: "pago" | "atrasada" | "carencia" | null = null;
      let carenciaAte: Date | null = null;
      if (t.mudou) {
        const dados: Prisma.FaturaUpdateInput = {};
        if (t.status) dados.status = t.status;
        if (t.status === "PAGA") dados.pagaEm = agora;
        if (t.status === "CANCELADA") dados.canceladaEm = agora;
        if (t.periodo) Object.assign(dados, { periodoInicio: t.periodo.inicio, periodoFim: t.periodo.fim });
        if (t.valorEstornado) dados.valorEstornado = t.valorEstornado;
        if (t.revisao) dados.revisao = t.revisao;
        if (t.vencimento) {
          // régua de cobrança (3 tentativas, carência) só para fatura devida
          const v = aplicarEvento({ faturaStatus: f.status, tentativas: f.tentativas, situacao: f.conta.situacaoCobranca as SituacaoCobranca, carenciaAte: f.conta.carenciaAte }, "VENCIDO", agora);
          Object.assign(dados, v.fatura, v.novaTentativaEm ? { vencimento: v.novaTentativaEm } : {});
          if (v.conta) await tx.conta.update({ where: { id: f.contaId }, data: { situacaoCobranca: v.conta.situacao, carenciaAte: v.conta.carenciaAte } });
          avisar = v.avisar;
          carenciaAte = v.conta?.carenciaAte ?? null;
        }
        await tx.fatura.update({ where: { id: f.id }, data: dados });
        if (t.status === "PAGA" && t.periodo) {
          avisar = "pago";
          if (f.conta.planoPendente === f.plano) await tx.conta.update({ where: { id: f.contaId }, data: { planoPendente: null, ...(f.plano === "PILOTO" ? { pilotoInicio: agora } : {}) } });
        }
      }
      await sincronizarPlano(tx, f.contaId, agora);
      if (opts.eventoId) await tx.eventoCobranca.update({ where: { id: opts.eventoId }, data: { resultado: t.motivo, faturaId: f.id } });
      return { resultado: t.mudou ? ("processado" as const) : ("ignorado" as const), motivo: t.motivo, contaId: f.contaId, valor: f.valor.toString(), link: f.linkPagamento, avisar, carenciaAte };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
  if ("avisar" in r && r.avisar) await avisarDonos(r.contaId, r.avisar, r.valor, r.link, r.carenciaAte);
  if ("avisar" in r && r.avisar === "pago") await registrarEvento("pagamento_confirmado", {});
  return r.resultado;
}

/**
 * Rotina diária (worker/cron): aplica mudanças agendadas, encerra períodos vencidos e gera a renovação
 * alguns dias antes do fim do período. Idempotente: rodar duas vezes não gera duas renovações.
 */
export async function renovarAssinaturas(agora = new Date()) {
  const resumo = { sincronizadas: 0, renovacoes: 0 };
  const vencendo = await db.conta.findMany({
    where: {
      demo: false,
      OR: [{ planoVigenteAte: { lte: agora } }, { mudancaAgendadaEm: { lte: agora } }, { planoVigenteAte: { lte: new Date(agora.getTime() + RENOVAR_DIAS_ANTES * 86_400_000) }, renovacaoCancelada: false }],
    },
  });
  for (const conta of vencendo) {
    await db.$transaction((tx) => sincronizarPlano(tx, conta.id, agora));
    resumo.sincronizadas++;
    const atual = await db.conta.findUniqueOrThrow({ where: { id: conta.id }, include: { empresas: { take: 1, orderBy: { criadoEm: "asc" } }, membros: { where: { papel: "DONO" }, include: { usuario: true }, take: 1 } } });
    if (atual.renovacaoCancelada || !atual.planoVigenteAte || atual.plano === "GRATIS" || atual.plano === "PILOTO") continue;
    if (atual.planoVigenteAte.getTime() - agora.getTime() > RENOVAR_DIAS_ANTES * 86_400_000) continue;
    const plano = atual.mudancaAgendada && atual.mudancaAgendada !== "GRATIS" ? atual.mudancaAgendada : atual.plano;
    const ciclo = (atual.ciclo === "ANUAL" ? "ANUAL" : "MENSAL") as Ciclo;
    const inicio = atual.planoVigenteAte;
    const criada = await db.$transaction(async (tx) => {
      // uma renovação por início de período (trava por conta para duas rotinas simultâneas)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`compra:${conta.id}`}))`;
      const existe = await tx.fatura.findFirst({ where: { contaId: conta.id, renovacao: true, periodoInicio: inicio, status: { not: "CANCELADA" } } });
      if (existe) return null;
      // compra (upgrade) aguardando pagamento: ela define o próximo período; renovar junto cobraria duas vezes
      const compra = await tx.fatura.findFirst({ where: { contaId: conta.id, renovacao: false, status: "ABERTA", vencimento: { gte: agora } } });
      if (compra) return null;
      const postos = await postosCobrados(tx, conta.id);
      const valor = valorDoPlano(plano, { postos, ciclo });
      return tx.fatura.create({
        data: {
          contaId: conta.id,
          referencia: inicio.toISOString().slice(0, 7),
          descricao: `Plano ${plano.toLowerCase()} (${ciclo === "ANUAL" ? "anual" : "mensal"}), renovação`,
          valor: valor.toFixed(2),
          postos,
          vencimento: inicio,
          plano,
          ciclo,
          periodoInicio: inicio,
          periodoFim: fimDoPeriodo(inicio, ciclo),
          renovacao: true,
        },
      });
    });
    if (!criada) continue;
    const g = cobranca();
    const email = atual.membros[0]?.usuario.email ?? "";
    const clienteId = await g.garantirCliente({ contaId: conta.id, nome: atual.empresas[0]?.razaoSocial ?? atual.nome, cpfCnpj: atual.empresas[0]?.cnpj ?? "", email, clienteIdAtual: atual.gatewayClienteId });
    const c = await g.criarCobranca({ clienteId, valor: criada.valor.toString(), vencimento: inicio.toISOString().slice(0, 10), descricao: criada.descricao, referenciaExterna: criada.id, metodo: "ESCOLHER" });
    await db.fatura.update({ where: { id: criada.id }, data: { gatewayId: c.id, linkPagamento: c.link } });
    resumo.renovacoes++;
  }
  return resumo;
}

/** Resumo da assinatura para a tela de cobrança (valores sempre do servidor). */
export async function resumoAssinatura(contaId: string, agora = new Date()) {
  const conta = await db.conta.findUniqueOrThrow({ where: { id: contaId } });
  const faturas = await db.fatura.findMany({ where: { contaId }, orderBy: { criadoEm: "desc" }, take: 24 });
  const postos = await postosCobrados(db, contaId);
  const ciclo = (conta.ciclo === "ANUAL" ? "ANUAL" : "MENSAL") as Ciclo;
  const proxima = faturas.find((f) => (f.status === "ABERTA" || f.status === "FALHOU") && f.renovacao);
  const pendenteCompra = faturas.find((f) => (f.status === "ABERTA" || f.status === "FALHOU") && !f.renovacao);
  const revisoes = faturas.filter((f) => f.revisao);
  return {
    conta,
    faturas,
    postos,
    ciclo,
    valorRenovacao: conta.plano === "CARTEIRA" || conta.plano === "ASSESSORIA" ? valorDoPlano(conta.mudancaAgendada && conta.mudancaAgendada !== "GRATIS" ? conta.mudancaAgendada : conta.plano, { postos, ciclo }).toFixed(2) : null,
    proxima,
    pendenteCompra,
    revisoes,
    devidaEmAberto: faturas.some((f) => faturaDevida(regra(f), agora)),
    totalEstornado: faturas.reduce((s, f) => s.plus(f.valorEstornado.toString()), new Decimal(0)).toFixed(2),
  };
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
