/**
 * "A receber": uma definição só, a da tela A receber. Entram os pedidos deferidos ou faturados; o valor de cada um é
 * o saldo ainda não recebido: retroativo aprovado (ou, na falta, o valor deferido) menos as baixas válidas.
 * Usada pela tela A receber, pelo cartão de Hoje, pela tela Clientes e pelo resumo semanal, para os quatro baterem.
 */
import { resumoFinanceiro, type BaixaResumo, type NotaResumo } from "./financeiro-pedido";
import { somarReais } from "./format";

export const ESTADOS_A_RECEBER = ["DEFERIDO", "FATURADO"] as const;

/** Notas e baixas que o saldo precisa (para o `include`/`select` do Prisma). */
export const LANCAMENTOS_A_RECEBER = {
  notasFiscais: { select: { id: true, valor: true, canceladaEm: true } },
  baixas: { select: { notaFiscalId: true, valor: true, canceladaEm: true } },
} as const;

type Valor = string | number | { toString(): string } | null | undefined;

export type PedidoAReceber = {
  estado: string;
  retroativoAprovado: Valor;
  valorDeferido: Valor;
  notasFiscais: NotaResumo[];
  baixas: BaixaResumo[];
};

export function estaAReceber(p: { estado: string }) {
  return (ESTADOS_A_RECEBER as readonly string[]).includes(p.estado);
}

/** Aprovado, faturado e recebido do pedido; a base é o retroativo aprovado ou, na falta, o valor deferido. */
export function financeiroDoPedido(p: Omit<PedidoAReceber, "estado">) {
  return resumoFinanceiro(String(p.retroativoAprovado ?? p.valorDeferido ?? 0), p.notasFiscais, p.baixas);
}

/** Saldo de um pedido deferido ou faturado ("0.00" para os demais estados). */
export function saldoAReceber(p: PedidoAReceber): string {
  return estaAReceber(p) ? financeiroDoPedido(p).totalPendente : "0.00";
}

/** Os pedidos a receber, cada um com o saldo, e o total. */
export function aReceber<P extends PedidoAReceber>(pedidos: P[]) {
  const itens = pedidos.filter(estaAReceber).map((p) => ({ pedido: p, saldo: saldoAReceber(p) }));
  return { itens, total: somarReais(itens.map((i) => i.saldo)) };
}
