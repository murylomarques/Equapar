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
  /** Garantia: na 1ª assinatura, devolução do valor pago se o cliente desistir em até N dias (lib/reembolso.ts; não garante resultado do pedido). */
  garantiaDias: 30,
};

/** Os preços que entram no valor da assinatura. O preço de fundador congela esta tabela por 24 meses. */
export type TabelaPrecos = {
  carteiraPorPosto: number;
  carteiraMinimo: number;
  assessoria: number;
  assessoriaPostosIncluidos: number;
  assessoriaPorPostoExtra: number;
  mesesPagosNoAnual: number;
};

export function tabelaAtual(): TabelaPrecos {
  return {
    carteiraPorPosto: PRECOS.carteiraPorPosto,
    carteiraMinimo: PRECOS.carteiraMinimo,
    assessoria: PRECOS.assessoria,
    assessoriaPostosIncluidos: PRECOS.assessoriaPostosIncluidos,
    assessoriaPorPostoExtra: PRECOS.assessoriaPorPostoExtra,
    mesesPagosNoAnual: PRECOS.mesesPagosNoAnual(),
  };
}

/** Lê uma tabela guardada (Json do banco); faltando ou inválida, null (vale a atual). */
export function tabelaGuardada(v: unknown): TabelaPrecos | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const chaves = ["carteiraPorPosto", "carteiraMinimo", "assessoria", "assessoriaPostosIncluidos", "assessoriaPorPostoExtra", "mesesPagosNoAnual"] as const;
  if (!chaves.every((k) => typeof o[k] === "number" && Number.isFinite(o[k]) && (o[k] as number) >= 0)) return null;
  return Object.fromEntries(chaves.map((k) => [k, o[k]])) as TabelaPrecos;
}

/** Valor avulso da Jornada 40h para um contrato com `postos` postos; null = acima da última faixa (sob consulta). */
export function precoJornada40(postos: number): number | null {
  return PRECOS.jornada40Faixas.find((f) => postos <= f.ate)?.valor ?? null;
}
