/**
 * Preços da página e da cobrança, sem dependências: pode ir para o navegador (calculadora) sem levar o decimal.js.
 * Fonte única: lib/planos.ts reexporta daqui.
 */
export const num = (v: string | undefined, padrao: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : padrao);

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
