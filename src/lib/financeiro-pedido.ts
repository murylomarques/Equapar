import Decimal from "decimal.js";
import { ErroUsuario } from "./acao";

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const r2 = (v: Decimal.Value) => new D(v).toDecimalPlaces(2, D.ROUND_HALF_UP);

export type NotaResumo = { id: string; valor: Decimal.Value; canceladaEm?: Date | null };
export type BaixaResumo = { notaFiscalId: string; valor: Decimal.Value; canceladaEm?: Date | null };

export function resumoFinanceiro(retroativoAprovado: Decimal.Value, notas: NotaResumo[], baixas: BaixaResumo[]) {
  const aprovado = r2(retroativoAprovado);
  const validas = notas.filter((n) => !n.canceladaEm);
  const ids = new Set(validas.map((n) => n.id));
  const faturado = validas.reduce((s, n) => s.plus(n.valor), new D(0));
  const recebido = baixas.filter((b) => !b.canceladaEm && ids.has(b.notaFiscalId)).reduce((s, b) => s.plus(b.valor), new D(0));
  return {
    aprovado: aprovado.toFixed(2),
    faturado: r2(faturado).toFixed(2),
    faltaFaturar: D.max(0, aprovado.minus(faturado)).toFixed(2),
    recebido: r2(recebido).toFixed(2),
    faturadoAReceber: D.max(0, faturado.minus(recebido)).toFixed(2),
    totalPendente: D.max(0, aprovado.minus(recebido)).toFixed(2),
    quitado: faturado.gte(aprovado) && recebido.gte(aprovado),
  };
}

export function validarLancamento(valor: Decimal.Value, saldo: Decimal.Value, nome = "valor") {
  const v = r2(valor);
  const s = r2(saldo);
  if (v.lte(0)) throw new ErroUsuario(`${nome} precisa ser maior que zero.`);
  if (v.gt(s)) throw new ErroUsuario(`${nome} supera o saldo disponível de ${s.toFixed(2)}.`);
  return v.toFixed(2);
}
