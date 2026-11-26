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

// ---------------------------------------------------------------------------
// Cancelamento de nota fiscal ou de recebimento (baixa) lançado por engano
// ---------------------------------------------------------------------------

export type NotaLancada = NotaResumo & { identificacao: string; emitidaEm: Date };
export type BaixaLancada = BaixaResumo & { id: string; recebidoEm: Date };

/**
 * Situação do pedido recalculada só com os lançamentos válidos (não cancelados): sem nota válida volta a
 * "Valor deferido"; com nota, "Diferença faturada" ou, se o recebido cobre o aprovado, "Dinheiro recebido".
 * As datas e o valor recebido gravados no pedido acompanham (o Recuperado e as listas leem esses campos).
 */
export function situacaoAposLancamentos(retroativoAprovado: Decimal.Value, notas: NotaLancada[], baixas: BaixaLancada[]) {
  const validas = notas.filter((n) => !n.canceladaEm);
  const ids = new Set(validas.map((n) => n.id));
  const baixasValidas = baixas.filter((b) => !b.canceladaEm && ids.has(b.notaFiscalId));
  const resumo = resumoFinanceiro(retroativoAprovado, notas, baixas);
  if (!validas.length) return { estado: "DEFERIDO" as const, faturadoEm: null, notaFiscal: null, recebidoEm: null, valorRecebido: null, resumo };
  const ultimaNota = validas.reduce((a, b) => (b.emitidaEm > a.emitidaEm ? b : a));
  const ultimaBaixa = baixasValidas.length ? baixasValidas.reduce((a, b) => (b.recebidoEm > a.recebidoEm ? b : a)) : null;
  return {
    estado: resumo.quitado ? ("RECEBIDO" as const) : ("FATURADO" as const),
    faturadoEm: ultimaNota.emitidaEm,
    notaFiscal: ultimaNota.identificacao,
    recebidoEm: ultimaBaixa?.recebidoEm ?? null,
    valorRecebido: ultimaBaixa ? resumo.recebido : null,
    resumo,
  };
}

export const MOTIVO_CANCELAMENTO_MIN = 5;

/** Confere se o lançamento pode ser cancelado; lança ErroUsuario com o motivo da recusa. */
export function validarCancelamento(tipo: "nota" | "baixa", item: { id: string; canceladaEm?: Date | null } | undefined, baixas: BaixaResumo[], motivo: string) {
  if (!item) throw new ErroUsuario(tipo === "nota" ? "Nota fiscal não encontrada neste pedido." : "Recebimento não encontrado neste pedido.");
  if (item.canceladaEm) throw new ErroUsuario("Este lançamento já foi cancelado.");
  if (motivo.trim().length < MOTIVO_CANCELAMENTO_MIN) throw new ErroUsuario("Explique o motivo do cancelamento (fica no histórico).");
  if (tipo === "nota" && baixas.some((b) => b.notaFiscalId === item.id && !b.canceladaEm))
    throw new ErroUsuario("Esta nota tem recebimentos registrados. Cancele antes os recebimentos dela.");
}

/**
 * Número e referência do lançamento cancelado ganham um sufixo: assim a nota certa pode ser lançada de novo
 * com o mesmo número e a mesma referência (o banco não aceita dois iguais no mesmo pedido).
 */
export function marcaCancelado(valor: string, id: string) {
  return `${valor} (cancelada ${id.slice(-6)})`;
}
