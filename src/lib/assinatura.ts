/**
 * P0. Regras puras da assinatura: o que cada evento do gateway faz com a fatura e qual acesso a conta tem.
 *
 * Princípios (política documentada em docs/auditoria/COBRANCA.md):
 *  - O acesso pago vem dos PERÍODOS efetivamente pagos (fatura PAGA com período), nunca do clique em "escolher plano".
 *  - Uma fatura cujo período já começou corresponde a serviço prestado: é devida e não é cancelada.
 *  - Uma fatura cujo período ainda não começou (compra nova ou renovação futura) deixa de ser devida se o cliente cancelar.
 *  - Eventos chegam fora de ordem e repetidos: as transições são monotônicas (fatura paga não volta a "vencida").
 *  - Pagamento depois do cancelamento não reativa nada: fica para revisão (devolução).
 *  - Estorno integral tira só o período daquela fatura; estorno parcial mantém o acesso e pede revisão.
 */
import Decimal from "decimal.js";
import type { Ciclo, PlanoId } from "./planos";

export type StatusFatura = "ABERTA" | "PAGA" | "FALHOU" | "CANCELADA" | "ESTORNADA";
export type EventoGateway = "PAGO" | "VENCIDO" | "ESTORNADO" | "ESTORNO_PARCIAL" | "CANCELADO" | "RESTAURADO" | "CHARGEBACK";

/** Ordem de valor dos planos pagos, para separar upgrade (imediato) de downgrade (no fim do período). */
export const ORDEM_PLANO: Record<PlanoId, number> = { GRATIS: 0, PILOTO: 1, CARTEIRA: 2, ASSESSORIA: 3 };

/** Fim do período: mesmo dia do mês seguinte (ou do ano seguinte), em UTC; dia 31 vira o último dia do mês. */
export function fimDoPeriodo(inicio: Date, ciclo: Ciclo): Date {
  const meses = ciclo === "ANUAL" ? 12 : 1;
  const y = inicio.getUTCFullYear();
  const m = inicio.getUTCMonth() + meses;
  const ultimoDia = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(inicio.getUTCDate(), ultimoDia), inicio.getUTCHours(), inicio.getUTCMinutes(), inicio.getUTCSeconds()));
}

export type FaturaRegra = {
  status: string;
  valor: Decimal.Value;
  valorEstornado?: Decimal.Value | null;
  periodoInicio: Date | null;
  periodoFim?: Date | null;
  ciclo?: string | null;
  plano?: PlanoId | null;
  revisao?: string | null;
  /** cancelada pela própria Equapar (pedido do cliente ou substituição): o gateway não a reabre */
  canceladaPelaEquapar?: boolean;
};

export type Transicao = {
  /** false: o evento não muda nada (repetido, fora de ordem ou sem efeito). */
  mudou: boolean;
  motivo: string;
  status?: StatusFatura;
  /** Período que o pagamento compra (só em PAGO de fatura devida). */
  periodo?: { inicio: Date; fim: Date };
  valorEstornado?: string;
  revisao?: string;
  /** VENCIDO: entra na régua de cobrança (tentativas, carência). */
  vencimento?: boolean;
};

const ABERTAS = new Set(["ABERTA", "FALHOU"]);

/** O que um evento faz com a fatura. Pura: o servidor aplica dentro de uma transação, com a fatura travada. */
export function transicao(f: FaturaRegra, evento: EventoGateway, agora: Date, extra: { valorEstornado?: Decimal.Value } = {}): Transicao {
  const s = f.status;
  switch (evento) {
    case "PAGO": {
      if (ABERTAS.has(s)) {
        const inicio = f.periodoInicio ?? agora; // renovação já tem início marcado (continuidade); compra nova começa no pagamento
        if (!f.plano || !f.ciclo) return { mudou: true, motivo: "pago (fatura sem plano: só registra)", status: "PAGA" };
        return { mudou: true, motivo: "pago", status: "PAGA", periodo: { inicio, fim: fimDoPeriodo(inicio, f.ciclo as Ciclo) } };
      }
      if (s === "CANCELADA") return { mudou: true, motivo: "pago depois do cancelamento: sem acesso, devolver", status: "PAGA", revisao: "PAGA_APOS_CANCELAMENTO" };
      return { mudou: false, motivo: `pago ignorado (fatura ${s.toLowerCase()})` };
    }
    case "VENCIDO":
      if (ABERTAS.has(s)) return { mudou: true, motivo: "vencida", vencimento: true };
      return { mudou: false, motivo: `vencimento ignorado (fatura ${s.toLowerCase()})` };
    case "CANCELADO":
      if (ABERTAS.has(s)) return { mudou: true, motivo: "cancelada no gateway", status: "CANCELADA" };
      return { mudou: false, motivo: `cancelamento ignorado (fatura ${s.toLowerCase()})` };
    case "RESTAURADO":
      // só reabre o que o gateway removeu sozinho; cancelamento pedido pelo cliente não volta
      if (s === "CANCELADA" && !f.canceladaPelaEquapar) return { mudou: true, motivo: "restaurada no gateway", status: "ABERTA" };
      return { mudou: false, motivo: `restauração ignorada (fatura ${s.toLowerCase()})` };
    case "ESTORNADO":
      // estorno integral: o período daquela fatura deixa de contar (os outros períodos pagos continuam)
      if (s === "PAGA" || ABERTAS.has(s)) return { mudou: true, motivo: "estorno integral", status: "ESTORNADA", valorEstornado: new Decimal(f.valor).toFixed(2) };
      return { mudou: false, motivo: `estorno ignorado (fatura ${s.toLowerCase()})` };
    case "ESTORNO_PARCIAL": {
      if (s !== "PAGA") return { mudou: false, motivo: `estorno parcial ignorado (fatura ${s.toLowerCase()})` };
      const v = extra.valorEstornado != null ? new Decimal(extra.valorEstornado) : null;
      if (v && v.gte(f.valor)) return { mudou: true, motivo: "estorno parcial do valor total", status: "ESTORNADA", valorEstornado: new Decimal(f.valor).toFixed(2) };
      // devolução do cancelamento (garantia ou proporcional do anual) feita pela equipe: o acesso já terminou; não é acordo novo
      if (f.revisao?.startsWith("REEMBOLSO_")) return { mudou: true, motivo: "devolução do cancelamento registrada", valorEstornado: v ? v.toFixed(2) : undefined };
      // acesso mantido: devolução parcial é acordo comercial; fica para revisão humana
      return { mudou: true, motivo: "estorno parcial: acesso mantido, revisar", valorEstornado: v ? v.toFixed(2) : undefined, revisao: "ESTORNO_PARCIAL" };
    }
    case "CHARGEBACK":
      if (s === "PAGA") return { mudou: true, motivo: "contestação aberta: acesso mantido até a decisão, revisar", revisao: "CHARGEBACK" };
      return { mudou: false, motivo: `contestação ignorada (fatura ${s.toLowerCase()})` };
  }
}

/** Fatura que corresponde a serviço já prestado (o período começou): não pode ser cancelada por mudança de plano. */
export function faturaDevida(f: Pick<FaturaRegra, "status" | "periodoInicio">, agora: Date) {
  return ABERTAS.has(f.status) && !!f.periodoInicio && f.periodoInicio <= agora;
}

/** Fatura em aberto que ainda não começou: deixa de ser devida se o cliente cancelar ou trocar o plano. */
export function faturaCancelavel(f: Pick<FaturaRegra, "status" | "periodoInicio">, agora: Date) {
  return ABERTAS.has(f.status) && !faturaDevida(f, agora);
}

/**
 * Acesso pago em `agora`, pelos períodos pagos. Com períodos sobrepostos (upgrade no meio do ciclo), vale o
 * período que começou por último. `ate` é o fim da sequência contínua de períodos pagos a partir de agora.
 */
export function direitoDeAcesso(faturas: FaturaRegra[], agora: Date): { plano: PlanoId | null; ate: Date | null; ciclo?: string | null } {
  const pagas = faturas
    // pagamento depois do cancelamento não compra período (vai ser devolvido)
    .filter((f) => f.status === "PAGA" && f.revisao !== "PAGA_APOS_CANCELAMENTO" && f.plano && f.periodoInicio && f.periodoFim)
    .sort((a, b) => a.periodoInicio!.getTime() - b.periodoInicio!.getTime());
  const ativas = pagas.filter((f) => f.periodoInicio! <= agora && agora < f.periodoFim!);
  if (!ativas.length) return { plano: null, ate: null };
  // períodos sobrepostos (upgrade pago depois de uma renovação já paga): vale o plano maior; empate, o mais recente
  const atual = [...ativas].sort((a, b) => ORDEM_PLANO[b.plano!] - ORDEM_PLANO[a.plano!] || b.periodoInicio!.getTime() - a.periodoInicio!.getTime())[0];
  let ate = new Date(Math.max(...ativas.map((f) => f.periodoFim!.getTime())));
  for (const f of pagas) if (f.periodoInicio! <= ate && f.periodoFim! > ate) ate = f.periodoFim!; // emenda renovações contínuas
  return { plano: atual.plano!, ate, ciclo: atual.ciclo };
}

/** Já houve alguma compra com período? Sem isso, o plano da conta é manual (Piloto combinado, conta antiga) e não é recalculado. */
export function temHistoricoPago(faturas: FaturaRegra[]) {
  return faturas.some((f) => f.periodoInicio && (f.status === "PAGA" || f.status === "ESTORNADA"));
}

export type ContaRegra = {
  plano: PlanoId;
  planoVigenteAte: Date | null;
  renovacaoCancelada: boolean;
  mudancaAgendada: PlanoId | null;
  mudancaAgendadaEm: Date | null;
};

/**
 * Plano efetivo da conta. Sem período pago ativo:
 *  - com renovação devida em aberto (régua de cobrança), mantém o plano até a carência decidir;
 *  - senão, volta ao Grátis (os dados ficam; só as funções pagas param).
 */
export function planoEfetivo(conta: ContaRegra, faturas: FaturaRegra[], agora: Date): { plano: PlanoId; planoVigenteAte: Date | null; limparAgendamento: boolean; ciclo?: string | null } {
  const vencida = !!conta.mudancaAgendadaEm && conta.mudancaAgendadaEm <= agora;
  if (!temHistoricoPago(faturas)) {
    // plano manual: só o agendamento do cliente muda alguma coisa
    if (vencida && conta.mudancaAgendada) return { plano: conta.mudancaAgendada, planoVigenteAte: null, limparAgendamento: true };
    return { plano: conta.plano, planoVigenteAte: conta.planoVigenteAte, limparAgendamento: false };
  }
  const d = direitoDeAcesso(faturas, agora);
  // mudança agendada cuja data passou e já tem período pago no plano novo: limpa o agendamento
  if (d.plano) return { plano: d.plano, planoVigenteAte: d.ate, limparAgendamento: vencida, ciclo: d.ciclo };
  const emCobranca = faturas.some((f) => faturaDevida(f, agora));
  if (emCobranca && !conta.renovacaoCancelada) return { plano: vencida && conta.mudancaAgendada ? conta.mudancaAgendada : conta.plano, planoVigenteAte: conta.planoVigenteAte, limparAgendamento: vencida };
  return { plano: "GRATIS", planoVigenteAte: conta.planoVigenteAte, limparAgendamento: vencida };
}

export type Previsao = { possivel: boolean; titulo: string; linhas: string[]; efeito: "IMEDIATO_APOS_PAGAMENTO" | "AGENDADO" | "IMEDIATO" | "REATIVAR" | "ANALISE_MANUAL" | "NENHUM"; quando: Date | null };

/** O que vai acontecer se o cliente confirmar a mudança: mostrado antes do botão de confirmar. */
export function preverMudanca(conta: ContaRegra & { ciclo?: string }, destino: PlanoId, agora: Date, cicloNovo?: Ciclo): Previsao {
  const ativo = !!conta.planoVigenteAte && conta.planoVigenteAte > agora && conta.plano !== "GRATIS";
  if (ativo && conta.plano === destino && !conta.renovacaoCancelada && cicloNovo && conta.ciclo && cicloNovo !== conta.ciclo)
    return {
      possivel: true,
      titulo: `Mudar para o ciclo ${cicloNovo === "ANUAL" ? "anual" : "mensal"} na renovação`,
      linhas: [`O período atual continua até ${dataBr(conta.planoVigenteAte!)}. A renovação será cobrada no ciclo novo.`, "Nada é cobrado agora."],
      efeito: "AGENDADO",
      quando: conta.planoVigenteAte,
    };
  if (destino === "PILOTO") return { possivel: false, titulo: "O Piloto é contratado por pedido", linhas: ["Fale com a gente pelo e-mail de contato para começar."], efeito: "NENHUM", quando: null };
  if (destino === "GRATIS") {
    if (conta.plano === "GRATIS" && !ativo) return { possivel: false, titulo: "Sua conta já está no plano Grátis", linhas: [], efeito: "NENHUM", quando: null };
    if (ativo)
      return {
        possivel: true,
        titulo: "Cancelar a renovação",
        linhas: [
          `Você continua com o plano atual até ${dataBr(conta.planoVigenteAte!)}, o período já pago.`,
          "Depois dessa data a conta passa para o Grátis: as funções pagas param, nenhuma cobrança nova é gerada.",
          "Seus contratos, pedidos, documentos e histórico ficam guardados e podem ser exportados a qualquer momento.",
          "Você pode desfazer o cancelamento até essa data.",
        ],
        efeito: "AGENDADO",
        quando: conta.planoVigenteAte,
      };
    return {
      possivel: true,
      titulo: "Voltar para o Grátis agora",
      linhas: ["Não há período pago em andamento. Cobranças ainda não iniciadas são canceladas.", "Seus dados ficam guardados e podem ser exportados."],
      efeito: "IMEDIATO",
      quando: agora,
    };
  }
  if (ativo && conta.plano === destino) {
    if (conta.renovacaoCancelada) return { possivel: true, titulo: "Manter a assinatura", linhas: [`A renovação volta a valer em ${dataBr(conta.planoVigenteAte!)}. Nada é cobrado agora.`], efeito: "REATIVAR", quando: null };
    return { possivel: false, titulo: "Este já é o seu plano", linhas: [`Período pago até ${dataBr(conta.planoVigenteAte!)}.`], efeito: "NENHUM", quando: null };
  }
  if (ativo && ORDEM_PLANO[destino] < ORDEM_PLANO[conta.plano])
    return {
      possivel: true,
      titulo: "Mudar de plano na renovação",
      linhas: [`O plano atual continua até ${dataBr(conta.planoVigenteAte!)}. A partir daí, a renovação é cobrada no plano novo.`, "Nada é cobrado agora."],
      efeito: "AGENDADO",
      quando: conta.planoVigenteAte,
    };
  // upgrade com período pago em andamento: sem política de crédito aprovada, não há cobrança segura
  // (cobrar o plano novo inteiro sobreporia períodos; descontar seria um crédito não aprovado). Vai para análise.
  if (ativo)
    return {
      possivel: false,
      titulo: "Upgrade com período pago em andamento",
      linhas: [
        `Seu plano atual está pago até ${dataBr(conta.planoVigenteAte!)}.`,
        "Para não cobrar o mesmo período duas vezes nem descartar o que você já pagou, o upgrade é combinado com a nossa equipe: fale com a gente e acertamos a data e o valor antes de qualquer cobrança.",
        `Se preferir esperar, o plano novo pode ser contratado depois de ${dataBr(conta.planoVigenteAte!)}.`,
      ],
      efeito: "ANALISE_MANUAL",
      quando: null,
    };
  return {
    possivel: true,
    titulo: "Contratar o plano",
    linhas: ["Abrimos uma cobrança. O plano passa a valer quando o pagamento for confirmado; o período começa nesse dia."],
    efeito: "IMEDIATO_APOS_PAGAMENTO",
    quando: null,
  };
}

function dataBr(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/**
 * Régua de cobrança pelo calendário, a partir do início do período devido e não pago. Não depende de o gateway
 * reenviar eventos: o Asaas avisa o vencimento uma vez só. Mesmos prazos da régua por evento (3 tentativas a
 * cada 5 dias, depois 15 dias de carência; passada a carência, somente leitura via situacaoEfetiva).
 */
export function situacaoPorAtraso(inicioDevido: Date, agora: Date, dias = { tentativas: 3, intervalo: 5, carencia: 15 }): { situacao: "EM_DIA" | "ATRASADA" | "CARENCIA"; carenciaAte: Date | null } {
  const dia = 86_400_000;
  const atraso = (agora.getTime() - inicioDevido.getTime()) / dia;
  if (atraso <= 0) return { situacao: "EM_DIA", carenciaAte: null };
  const fimTentativas = (dias.tentativas - 1) * dias.intervalo;
  if (atraso < fimTentativas) return { situacao: "ATRASADA", carenciaAte: null };
  return { situacao: "CARENCIA", carenciaAte: new Date(inicioDevido.getTime() + (fimTentativas + dias.carencia) * dia) };
}
