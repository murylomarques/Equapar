/**
 * 5.2: "Recuperado com a Equapar". Soma o que foi deferido e o que foi recebido, por ano e por contrato.
 * Só soma valores registrados (valorDeferido, valorRecebido); não estima nada.
 */
import { somarReais } from "./format";

type Num = { toString(): string } | null;
export interface PedidoRecuperado {
  contratoId: string;
  contrato: { numero: string; orgao: string };
  deferidoEm: Date | null;
  valorDeferido: Num;
  recebidoEm: Date | null;
  valorRecebido: Num;
}

export function resumoRecuperado(pedidos: PedidoRecuperado[]) {
  const deferidos = pedidos.filter((p) => p.deferidoEm && p.valorDeferido != null);
  const recebidos = pedidos.filter((p) => p.recebidoEm && p.valorRecebido != null);
  const anos = [...new Set([...deferidos.map((p) => p.deferidoEm!.getUTCFullYear()), ...recebidos.map((p) => p.recebidoEm!.getUTCFullYear())])].sort((a, b) => b - a);
  const porAno = anos.map((ano) => ({
    ano,
    deferido: somarReais(deferidos.filter((p) => p.deferidoEm!.getUTCFullYear() === ano).map((p) => p.valorDeferido)),
    recebido: somarReais(recebidos.filter((p) => p.recebidoEm!.getUTCFullYear() === ano).map((p) => p.valorRecebido)),
  }));
  const ids = [...new Set([...deferidos, ...recebidos].map((p) => p.contratoId))];
  const porContrato = ids
    .map((id) => {
      const ps = pedidos.filter((p) => p.contratoId === id);
      return {
        contratoId: id,
        numero: ps[0].contrato.numero,
        orgao: ps[0].contrato.orgao,
        deferido: somarReais(ps.filter((p) => p.deferidoEm).map((p) => p.valorDeferido)),
        recebido: somarReais(ps.filter((p) => p.recebidoEm).map((p) => p.valorRecebido)),
      };
    })
    .sort((a, b) => b.recebido.comparedTo(a.recebido) || b.deferido.comparedTo(a.deferido));
  return {
    porAno,
    porContrato,
    totalDeferido: somarReais(deferidos.map((p) => p.valorDeferido)),
    totalRecebido: somarReais(recebidos.map((p) => p.valorRecebido)),
  };
}
