import { dec, r2 } from "./calculo/motor";

/**
 * Raio-X: quanto vale 1% de reajuste por mês, a partir de dados públicos do PNCP.
 * Valor mensal estimado = valor global publicado ÷ meses de vigência; 1% = esse valor × 0,01.
 * É uma ordem de grandeza para o cliente, não uma estimativa de valor a recuperar (isso depende da planilha e da convenção).
 */

type ContratoComValor = { valorGlobal: number | null; inicio: string; fim: string };

const DIAS_POR_MES = "30.4375"; // 365,25 ÷ 12

/** Meses de vigência entre início e fim (AAAA-MM-DD), arredondados; menos de 1 mês conta como 1. Datas inválidas: null. */
export function mesesVigencia(inicio: string, fim: string): number | null {
  const t = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s ?? "") ? Date.parse(`${s}T00:00:00Z`) : NaN);
  const a = t(inicio);
  const b = t(fim);
  // início igual ao fim é o que o PNCP devolve quando a data de início falta (ver pncp.ts): sem base para estimar
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  const dias = Math.round((b - a) / 86_400_000);
  return Math.max(1, dec(dias).div(DIAS_POR_MES).toDecimalPlaces(0).toNumber());
}

/** Valor de 1% de reajuste por mês, em reais com 2 casas ("1234.56"). Sem valor publicado ou sem datas: null. */
export function umPorCentoMensal(c: ContratoComValor): string | null {
  if (c.valorGlobal == null || !Number.isFinite(c.valorGlobal) || c.valorGlobal <= 0) return null;
  const meses = mesesVigencia(c.inicio, c.fim);
  if (meses == null) return null;
  return r2(dec(c.valorGlobal).div(meses).times("0.01")).toFixed(2);
}

/** Soma do 1% mensal dos contratos que têm a estimativa (cada parcela já com 2 casas). Nenhum: null. */
export function umPorCentoMensalTotal(contratos: ContratoComValor[]): string | null {
  const valores = contratos.map(umPorCentoMensal).filter((v): v is string => v != null);
  if (valores.length === 0) return null;
  return valores.reduce((s, v) => s.plus(dec(v)), dec("0")).toFixed(2);
}

/** O Raio-X como a tela e o PDF recebem: cada contrato com o 1% mensal estimado (ou null) e o total. */
export type ComUmPorCento<R extends { contratos: ContratoComValor[] }> = Omit<R, "contratos"> & {
  contratos: (R["contratos"][number] & { umPorCentoMes: string | null })[];
  umPorCentoMesTotal: string | null;
};

export function comUmPorCento<R extends { contratos: ContratoComValor[] }>(r: R): ComUmPorCento<R> {
  return {
    ...r,
    contratos: r.contratos.map((c) => ({ ...c, umPorCentoMes: umPorCentoMensal(c) })),
    umPorCentoMesTotal: umPorCentoMensalTotal(r.contratos),
  };
}
