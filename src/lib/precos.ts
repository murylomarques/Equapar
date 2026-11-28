/**
 * Preços da página e da cobrança, sem dependências: pode ir para o navegador (calculadora) sem levar o decimal.js.
 * Fonte única: lib/planos.ts reexporta daqui. Decisões do dono de 27/11/2026 (relatório do conselho, seção 5):
 * preços públicos mantidos até 5 clientes pagantes; anual "12 pelo preço de 10"; preço de fundador; garantia de 30 dias;
 * Assessoria com teto de postos; Jornada 40h incluída no anual e avulsa por faixa.
 */
export const num = (v: string | undefined, padrao: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : padrao);

/** Inteiro dentro de [min, max]; fora disso (ou inválido), o padrão. Evita anual de graça ou negativo por erro de configuração. */
const inteiroEntre = (v: string | undefined, min: number, max: number, padrao: number) => {
  const n = num(v, padrao);
  return Number.isInteger(n) && n >= min && n <= max ? n : padrao;
};

export const PRECOS = {
  /** Carteira: R$ 4 por posto por mês, mínimo de R$ 297. */
  carteiraPorPosto: 4,
  carteiraMinimo: 297,
  /** Assessoria: R$ 1.497 por mês até 20 clientes e 1.500 postos somados; acima disso, R$ 1 por posto. */
  assessoria: 1497,
  assessoriaPostosIncluidos: 1500,
  /** Clientes incluídos no Assessoria (ASSESSORIA_MAX_CLIENTES, padrão 20). */
  assessoriaClientes: () => inteiroEntre(process.env.ASSESSORIA_MAX_CLIENTES, 1, 10_000, 20),
  assessoriaPorPostoExtra: 1,
  /** Piloto: R$ 1.500 pelo primeiro pedido, até 50 postos (acima, sob consulta); abatido se assinar o anual em 60 dias. */
  pilotoPorPedido: 1500,
  pilotoPostosIncluidos: 50,
  pilotoAbatimentoDias: 60,
  /**
   * Pacote "Jornada 40 horas" avulso, por contrato (as duas etapas, 42 e 40 horas), por faixa de postos do contrato.
   * Acima da última faixa, sob consulta. Incluído para quem assina o anual.
   */
  jornada40Faixas: [
    { ate: 30, valor: 990 },
    { ate: 100, valor: 1990 },
  ] as const,
  /** Anual: paga N meses e leva 12 (padrão 10). MESES_PAGOS_ANUAL entre 1 e 12; fora disso, vale 10. */
  mesesPagosNoAnual: () => inteiroEntre(process.env.MESES_PAGOS_ANUAL, 1, 12, 10),
  /** Preço de fundador: os primeiros N clientes mantêm o preço por M meses. */
  fundadorClientes: 10,
  fundadorMeses: 24,
  /** Garantia: devolução da 1ª mensalidade se o cliente desistir em até N dias (não garante resultado do pedido). */
  garantiaDias: 30,
};

/** Valor avulso da Jornada 40h para um contrato com `postos` postos; null = acima da última faixa (sob consulta). */
export function precoJornada40(postos: number): number | null {
  return PRECOS.jornada40Faixas.find((f) => postos <= f.ate)?.valor ?? null;
}
