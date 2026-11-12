import { brl, dec } from "./calculo/motor";
import { plural, relativo } from "./mascaras";

export { plural };

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

const TZ = "America/Sao_Paulo";

export function data(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Data de um registro com hora (criadoEm, geradoEm...) no fuso de Brasília. */
export function dataLocal(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function dataHora(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
}

export function hora(d: Date) {
  return d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

/** Hoje à meia-noite UTC (as datas de contrato são guardadas como dia, em UTC). */
export function hojeUTC(agora = new Date()) {
  const s = agora.toLocaleDateString("en-CA", { timeZone: TZ }); // AAAA-MM-DD no fuso de Brasília
  return new Date(`${s}T00:00:00Z`);
}

export function diasAte(d: Date | string, agora = new Date()) {
  const alvo = new Date(d);
  const a = Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), alvo.getUTCDate());
  return Math.round((a - hojeUTC(agora).getTime()) / 86_400_000);
}

/** Instante de n dias atrás (para filtros de consulta). */
export function diasAtras(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}

export function addDias(d: Date, n: number) {
  return new Date(d.getTime() + n * 86_400_000);
}

export function addMeses(d: Date, n: number) {
  const r = new Date(d);
  const dia = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + n);
  const max = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(dia, max));
  return r;
}

export function emDias(n: number) {
  return relativo(n);
}

/** "2026-03-15" (input type=date) -> Date UTC; vazio -> null */
export function lerData(v: FormDataEntryValue | null): Date | null {
  const s = (v ?? "").toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00Z`);
}

export function paraInputData(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

/** Converte "1.234,56" ou "1234.56" para "1234.56"; inválido -> null */
export function lerDinheiro(v: FormDataEntryValue | null): string | null {
  let s = (v ?? "").toString().trim().replace(/R\$\s?/i, "").replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(s) ? s : null;
}

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function saudacao(agora = new Date()) {
  const h = Number(agora.toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hour12: false }));
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
