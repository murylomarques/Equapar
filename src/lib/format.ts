import { brl, dec } from "./calculo/motor";

export { brl };

type Num = string | number | { toString(): string } | null | undefined;

export function reais(v: Num) {
  return brl(dec(v == null ? "0" : v.toString()));
}

/** Resumo arredondado: "R$ 48,3 mil", "R$ 1,2 mi" (Produto e experiência: números nos resumos) */
export function reaisResumo(v: Num) {
  const n = Number(v == null ? 0 : v.toString());
  const abs = Math.abs(n);
  const f = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  if (abs >= 1_000_000) return `R$ ${f(n / 1_000_000)} mi`;
  if (abs >= 1_000) return `R$ ${f(n / 1_000)} mil`;
  return `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
}

export * from "./datas";

/** L10. Soma de valores em dinheiro com o Decimal do motor (sem erro de ponto flutuante). */
export function somarReais(valores: Num[]) {
  return valores.reduce<ReturnType<typeof dec>>((s, v) => s.plus(dec(v == null ? "0" : v.toString())), dec("0"));
}
