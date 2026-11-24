import Decimal from "decimal.js";

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type CompetenciaRetroativo = {
  competencia: string;
  diferencaMensal: string;
  dias: number;
  divisor: number;
  base?: string;
  periodo?: string;
};

/** Cálculo independente por competência; cada linha é arredondada antes da soma. */
export function calcularRetroativoCompetencias(competencias: CompetenciaRetroativo[], abatimentos: string | number = 0) {
  const vistos = new Set<string>();
  const linhas = competencias.map((c) => {
    if (vistos.has(c.competencia)) throw new Error(`Competência sobreposta: ${c.competencia}.`);
    vistos.add(c.competencia);
    if (!/^\d{4}-\d{2}$/.test(c.competencia) || c.dias <= 0 || c.divisor <= 0 || c.dias > c.divisor) throw new Error(`Intervalo inválido em ${c.competencia}.`);
    const valor = new D(c.diferencaMensal).times(c.dias).div(c.divisor).toDecimalPlaces(2, D.ROUND_HALF_UP);
    return { ...c, valor: valor.toFixed(2) };
  });
  const bruto = linhas.reduce((s, c) => s.plus(c.valor), new D(0)).toDecimalPlaces(2, D.ROUND_HALF_UP);
  const desconto = new D(abatimentos).toDecimalPlaces(2, D.ROUND_HALF_UP);
  return { linhas, bruto: bruto.toFixed(2), abatimentos: desconto.toFixed(2), liquido: D.max(0, bruto.minus(desconto)).toFixed(2), regra: "Decimal, duas casas, meio para cima por competência; mês comercial de 30 dias quando informado" };
}
