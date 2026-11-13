/**
 * Fase 1 (4.2). Preços e regras de cobrança (puras). Valores da página de preços; os que o dono ainda
 * decide ficam em configuração (variáveis de ambiente), com o padrão proposto e anotado no relatório.
 */
import Decimal from "decimal.js";

export type PlanoId = "GRATIS" | "PILOTO" | "CARTEIRA" | "ASSESSORIA";
export type Ciclo = "MENSAL" | "ANUAL";

const num = (v: string | undefined, padrao: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : padrao);

export const PRECOS = {
  /** Carteira: R$ 4 por posto por mês, mínimo de R$ 297. */
  carteiraPorPosto: 4,
  carteiraMinimo: 297,
  /** Assessoria: a partir de R$ 1.497 por mês. */
  assessoria: 1497,
  /** Piloto: a partir de R$ 1.500 por pedido. */
  pilotoPorPedido: 1500,
  /** Pacote "Jornada 40 horas", por contrato (cobre as etapas de 42 e de 40 horas). Proposta: R$ 990. */
  jornada40PorContrato: () => num(process.env.PRECO_JORNADA40_CONTRATO, 990),
  /** Desconto do plano anual, em %. Decisão do dono (fase 2): 0 até lá. */
  descontoAnualPct: () => num(process.env.DESCONTO_ANUAL_PCT, 0),
};

/** Valor de uma fatura do ciclo: mensal ou 12 meses com o desconto anual. */
export function valorDoPlano(plano: PlanoId, opts: { postos: number; ciclo: Ciclo }): Decimal {
  let mensal: Decimal;
  if (plano === "CARTEIRA") mensal = Decimal.max(PRECOS.carteiraMinimo, new Decimal(PRECOS.carteiraPorPosto).times(Math.max(0, opts.postos)));
  else if (plano === "ASSESSORIA") mensal = new Decimal(PRECOS.assessoria);
  else return new Decimal(0); // Grátis: nada; Piloto: cobrado por pedido, não por mês
  if (opts.ciclo === "MENSAL") return mensal.toDecimalPlaces(2);
  return mensal
    .times(12)
    .times(new Decimal(100).minus(PRECOS.descontoAnualPct()).div(100))
    .toDecimalPlaces(2);
}

// ---------------------------------------------------------------------------
// Pagamento que falha: 3 tentativas, avisos e carência antes de virar somente leitura.
// Nunca apagar dados por falta de pagamento.
// ---------------------------------------------------------------------------

export const TENTATIVAS_COBRANCA = 3;
export const CARENCIA_DIAS = 15; // decisão do dono (12/11/2026)
export const NOVA_TENTATIVA_DIAS = 5;

export type SituacaoCobranca = "EM_DIA" | "ATRASADA" | "CARENCIA" | "SOMENTE_LEITURA";
export type EventoPagamento = "PAGO" | "VENCIDO" | "ESTORNADO" | "CANCELADO";

type Estado = { faturaStatus: string; tentativas: number; situacao: SituacaoCobranca; carenciaAte: Date | null };

/** O que muda na fatura e na conta quando chega um evento do gateway. */
export function aplicarEvento(e: Estado, evento: EventoPagamento, agora = new Date()) {
  if (evento === "PAGO") return { fatura: { status: "PAGA" }, conta: { situacao: "EM_DIA" as SituacaoCobranca, carenciaAte: null }, aplicarPlano: true, novaTentativaEm: null, avisar: "pago" as const };
  if (evento === "CANCELADO" || evento === "ESTORNADO") return { fatura: { status: "CANCELADA" }, conta: null, aplicarPlano: false, novaTentativaEm: null, avisar: null };
  // VENCIDO
  const tentativas = e.tentativas + 1;
  if (tentativas < TENTATIVAS_COBRANCA)
    return {
      fatura: { status: "ABERTA", tentativas },
      conta: { situacao: "ATRASADA" as SituacaoCobranca, carenciaAte: null },
      aplicarPlano: false,
      novaTentativaEm: new Date(agora.getTime() + NOVA_TENTATIVA_DIAS * 86_400_000),
      avisar: "atrasada" as const,
    };
  return {
    fatura: { status: "FALHOU", tentativas },
    conta: { situacao: "CARENCIA" as SituacaoCobranca, carenciaAte: e.carenciaAte ?? new Date(agora.getTime() + CARENCIA_DIAS * 86_400_000) },
    aplicarPlano: false,
    novaTentativaEm: null,
    avisar: "carencia" as const,
  };
}

/** Passada a carência sem pagamento, a conta fica só para leitura (os dados continuam lá). */
export function situacaoEfetiva(situacao: string, carenciaAte: Date | null, agora = new Date()): SituacaoCobranca {
  if (situacao === "CARENCIA" && carenciaAte && carenciaAte < agora) return "SOMENTE_LEITURA";
  return situacao as SituacaoCobranca;
}

// ---------------------------------------------------------------------------
// Limites por plano, checados no servidor. Só valem com COBRANCA_EXIGIR_PLANO=true (o dono liga junto
// com a cobrança); até lá, ninguém é bloqueado.
// ---------------------------------------------------------------------------

export function exigirPlanoLigado() {
  return process.env.COBRANCA_EXIGIR_PLANO === "true";
}

/** Motivo do bloqueio, ou null se pode. */
export function limiteDoPlano(plano: PlanoId, acao: { tipo: "gerar_pedido" } | { tipo: "adicionar_cliente"; clientesAtuais: number }): string | null {
  if (!exigirPlanoLigado()) return null;
  if (acao.tipo === "gerar_pedido" && plano === "GRATIS") return "Gerar o pedido faz parte do Piloto ou da assinatura. Escolha um plano em Configurações › Cobrança.";
  if (acao.tipo === "adicionar_cliente") {
    const max = num(process.env.ASSESSORIA_MAX_CLIENTES, 20);
    if (plano !== "ASSESSORIA") return "Vários clientes fazem parte do plano Assessoria.";
    if (acao.clientesAtuais >= max) return `O plano Assessoria atual vai até ${max} clientes. Fale com a gente para ampliar.`;
  }
  return null;
}
