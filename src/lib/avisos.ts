/**
 * Rotina de avisos (Produto e experiência, "Mensagens fora do produto").
 * Idempotente: pode rodar de hora em hora; cada aviso tem chave única por destino.
 */
import type { Conta, Contrato, Convencao, Pedido, Usuario } from "@prisma/client";
import { db } from "./db";
import { appUrl, enviar, MODELOS, type ModeloWhatsapp } from "./mensagens";
import { acoesDoContrato, contratosComPrazoEm, prazoResposta } from "./prazos";
import { data, diasAte, hojeUTC, plural, reais, reaisResumo } from "./format";

type Prefs = { prazo?: "EMAIL" | "WHATSAPP" | "AMBOS"; resposta?: "EMAIL" | "WHATSAPP" | "AMBOS"; deferido?: "EMAIL" | "WHATSAPP" | "AMBOS"; semanal?: boolean; hora?: number };

export const PREFS_PADRAO: Required<Prefs> = { prazo: "AMBOS", resposta: "EMAIL", deferido: "AMBOS", semanal: true, hora: 7 };

export function prefsDe(u: Pick<Usuario, "prefsAvisos">): Required<Prefs> {
  return { ...PREFS_PADRAO, ...((u.prefsAvisos as Prefs | null) ?? {}) };
}

type ContratoAviso = Contrato & { convencao: Convencao | null; pedidos: Pedido[] };

function canais(u: Usuario, escolha: "EMAIL" | "WHATSAPP" | "AMBOS") {
  const out: { canal: "EMAIL" | "WHATSAPP"; destino: string }[] = [];
  if (!u.emailVerificadoEm) return out; // C7: sem e-mail confirmado, não recebe avisos
  if (escolha !== "WHATSAPP") out.push({ canal: "EMAIL", destino: u.email });
  if (escolha !== "EMAIL" && u.whatsapp && u.whatsappConsentEm) out.push({ canal: "WHATSAPP", destino: u.whatsapp });
  return out;
}

async function avisarContrato(conta: Conta, usuarios: Usuario[], c: ContratoAviso, tipo: "D60" | "D30" | "D7") {
  const pedidoAtivo = c.pedidos.find((p) => !["RECEBIDO", "INDEFERIDO"].includes(p.estado));
  const situacao = pedidoAtivo ? NOME_ESTADO[pedidoAtivo.estado] : "nenhum pedido aberto";
  const link = tipo === "D7" ? `/app/contratos/${c.id}/prorrogacao` : `/app/contratos/${c.id}?aba=prazos`;
  const params: Record<string, string> = {
    numero: c.numero,
    orgao: c.orgao,
    data: data(c.vigenciaFim),
    ano: String(c.convencao?.ano ?? hojeUTC().getUTCFullYear()),
    situacao,
    link: appUrl(link),
  };
  const modelo: ModeloWhatsapp = tipo === "D60" ? "equapar_prazo_60" : tipo === "D30" ? "equapar_prazo_30" : "equapar_prazo_7";
  const corpo = MODELOS[modelo](params);
  const dias = tipo === "D60" ? 60 : tipo === "D30" ? 30 : 7;
  for (const u of usuarios) {
    for (const d of canais(u, prefsDe(u).prazo)) {
      await enviar({
        contaId: conta.id,
        contratoId: c.id,
        chave: `${tipo}:${c.id}:${c.vigenciaFim.toISOString().slice(0, 10)}`,
        tipo,
        canal: d.canal,
        destino: d.destino,
        assunto: `Em ${dias} dias: contrato ${c.numero} (${c.orgao})`,
        corpo,
        modelo: { nome: modelo, params },
      });
    }
  }
}

export const NOME_ESTADO: Record<string, string> = {
  EM_ANALISE: "oportunidade em análise",
  CALCULO_VALIDADO: "cálculo validado",
  PROTOCOLADO: "pedido protocolado",
  DEFERIDO: "valor deferido",
  FATURADO: "diferença faturada",
  RECEBIDO: "dinheiro recebido",
  INDEFERIDO: "indeferido",
};

/** Aviso imediato quando o protocolo é registrado. */
export async function avisarProtocolo(pedidoId: string) {
  const p = await db.pedido.findUnique({ where: { id: pedidoId }, include: { contrato: { include: { empresa: { include: { conta: { include: { membros: { include: { usuario: true } } } } } } } } } });
  if (!p?.protocoloData) return;
  const conta = p.contrato.empresa.conta;
  const params = {
    numero: p.contrato.numero,
    dataProtocolo: data(p.protocoloData),
    dataResposta: data(prazoResposta(p)),
    link: appUrl(`/app/pedidos/${p.id}/pronto`),
  };
  for (const m of conta.membros) {
    for (const d of canais(m.usuario, prefsDe(m.usuario).resposta)) {
      await enviar({
        contaId: conta.id,
        contratoId: p.contratoId,
        chave: `RESPOSTA:${p.id}:${params.dataProtocolo}`,
        tipo: "RESPOSTA",
        canal: d.canal,
        destino: d.destino,
        assunto: `Protocolado: contrato ${p.contrato.numero} (${p.contrato.orgao})`,
        corpo: MODELOS.equapar_prazo_resposta(params),
        modelo: { nome: "equapar_prazo_resposta", params },
      });
    }
  }
}

export async function avisarDeferido(pedidoId: string) {
  const p = await db.pedido.findUnique({ where: { id: pedidoId }, include: { contrato: { include: { empresa: { include: { conta: { include: { membros: { include: { usuario: true } } } } } } } } } });
  if (!p) return;
  const conta = p.contrato.empresa.conta;
  const params = { numero: p.contrato.numero, link: appUrl(`/app/a-receber`) };
  let corpo = MODELOS.equapar_deferido(params);
  for (const m of conta.membros) {
    for (const d of canais(m.usuario, prefsDe(m.usuario).deferido)) {
      // Valores em dinheiro no WhatsApp só se a conta ligou a opção (Configurações)
      if (d.canal === "EMAIL" && p.valorDeferido) corpo = `${MODELOS.equapar_deferido(params)}\nValor deferido: ${reais(p.valorDeferido)}.`;
      if (d.canal === "WHATSAPP") corpo = MODELOS.equapar_deferido(params);
      await enviar({
        contaId: conta.id,
        contratoId: p.contratoId,
        chave: `DEFERIDO:${p.id}`,
        tipo: "DEFERIDO",
        canal: d.canal,
        destino: d.destino,
        assunto: `Deferido: contrato ${p.contrato.numero} (${p.contrato.orgao})`,
        corpo,
        modelo: { nome: "equapar_deferido", params },
      });
    }
  }
}

function semanaIso(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-S${Math.ceil(((t.getTime() - ini.getTime()) / 86_400_000 + 1) / 7)}`;
}

/** Roda os avisos. Com `contaId`, só daquela conta (S5: "Verificar prazos agora" não toca nas outras). */
export async function rodarAvisos({ contaId, agora = new Date() }: { contaId?: string; agora?: Date } = {}) {
  const hoje = hojeUTC(agora);
  const resumo = { prazos: 0, semanais: 0, apostilamento: 0 };
  const horaBr = Number(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }));
  const segunda = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay() === 1;

  const contas = await db.conta.findMany({
    ...(contaId ? { where: { id: contaId } } : {}),
    include: { membros: { include: { usuario: true } }, empresas: { select: { exemplo: true } } },
  });
  for (const conta of contas) {
    // C6/L9: demonstração e contas só com empresas de exemplo (fictícias) não recebem avisos
    if (conta.demo || (conta.empresas.length > 0 && conta.empresas.every((e) => e.exemplo))) continue;
    const usuarios = conta.membros.map((m) => m.usuario);
    const contratos = await db.contrato.findMany({
      where: { arquivado: false, empresa: { contaId: conta.id } },
      include: { convencao: true, pedidos: true },
    });

    for (const c of contratos) {
      const d = diasAte(c.vigenciaFim, agora);
      const tipo = d < 0 ? null : d <= 7 ? "D7" : d <= 30 ? "D30" : d <= 60 ? "D60" : null;
      if (tipo) {
        await avisarContrato(conta, usuarios, c, tipo);
        resumo.prazos++;
      }
      // 30 dias depois do deferimento sem apostilamento: e-mail (o item também sobe em "Precisa de você")
      for (const p of c.pedidos) {
        if (p.estado === "DEFERIDO" && !p.apostiladoEm && p.deferidoEm && diasAte(p.deferidoEm, agora) <= -30) {
          for (const u of usuarios) {
            const r = await enviar({
              contaId: conta.id,
              contratoId: c.id,
              chave: `APOSTILAMENTO:${p.id}`,
              tipo: "APOSTILAMENTO",
              canal: "EMAIL",
              destino: u.email,
              assunto: `Sem apostilamento há 30 dias: contrato ${c.numero} (${c.orgao})`,
              corpo: `Equapar: o pedido do contrato ${c.numero} (${c.orgao}) foi deferido em ${data(p.deferidoEm)} e ainda não foi apostilado. Sem apostilamento e sem fatura da diferença, o dinheiro não entra. Abrir: ${appUrl("/app/a-receber")}`,
            });
            if (r) resumo.apostilamento++;
          }
        }
      }
    }

    // Resumo semanal: segunda às 7h (ou no horário escolhido)
    if (segunda) {
      const acoes = contratos.flatMap((c) => acoesDoContrato(c, hoje)).filter((a) => !a.limite || diasAte(a.limite, agora) <= 7);
      const comPrazo = contratosComPrazoEm(contratos, 7, hoje).length; // L1: mesma regra do cartão de Hoje e do filtro
      const aguardando = contratos.flatMap((c) => c.pedidos.filter((p) => p.estado === "PROTOCOLADO").map((p) => ({ c, p })));
      const receber = contratos.flatMap((c) => c.pedidos.filter((p) => p.estado === "DEFERIDO" || p.estado === "FATURADO").map((p) => ({ c, p })));
      const totalReceber = receber.reduce((s, { p }) => s + Number(p.valorDeferido ?? p.diferencaRetroativa ?? 0), 0);
      for (const u of usuarios) {
        const pr = prefsDe(u);
        if (!pr.semanal || horaBr < pr.hora) continue;
        const linhas = [
          `Sua semana na Equapar`,
          ``,
          `PRECISA DE VOCÊ (${acoes.length})`,
          ...acoes.map((a) => `- ${a.titulo} · Contrato ${a.contratoNumero} · ${a.orgao} · ${a.detalhe}: ${appUrl(a.href)}`),
          ``,
          `AGUARDANDO O ÓRGÃO (${aguardando.length})`,
          ...aguardando.map(({ c, p }) => `- Contrato ${c.numero} · ${c.orgao} · protocolado em ${data(p.protocoloData)}: ${appUrl(`/app/pedidos/${p.id}/pronto`)}`),
          ``,
          `A RECEBER: ${reaisResumo(totalReceber)}`,
          ...receber.map(({ c, p }) => `- Contrato ${c.numero} · ${c.orgao} · ${reais(p.valorDeferido ?? p.diferencaRetroativa)}: ${appUrl("/app/a-receber")}`),
        ];
        const r = await enviar({
          contaId: conta.id,
          chave: `SEMANAL:${u.id}:${conta.id}:${semanaIso(hoje)}`, // L9: um resumo por conta
          tipo: "SEMANAL",
          canal: "EMAIL",
          destino: u.email,
          assunto: `Sua semana: ${plural(comPrazo, "contrato com prazo", "contratos com prazo")}, ${aguardando.length} pedidos no órgão, ${reaisResumo(totalReceber)} a receber`,
          corpo: linhas.join("\n"),
        });
        if (r) resumo.semanais++;
      }
    }
  }
  return resumo;
}
