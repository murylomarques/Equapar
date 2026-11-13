import "server-only";
import { db } from "./db";

/**
 * 5.5: documentos com versão. Um documento do mesmo tipo enviado de novo no mesmo pedido (ou no mesmo
 * contrato, fora de pedido) ganha a versão seguinte; as anteriores ficam guardadas.
 */
export async function proximaVersao(onde: { pedidoId: string } | { contratoId: string } | { convencaoId: string }, tipo: string) {
  const where =
    "pedidoId" in onde ? { pedidoId: onde.pedidoId, tipo } : "convencaoId" in onde ? { convencaoId: onde.convencaoId, tipo } : { contratoId: onde.contratoId, pedidoId: null, tipo };
  const ultimo = await db.documento.findFirst({ where, orderBy: { versao: "desc" }, select: { versao: true } });
  return (ultimo?.versao ?? 0) + 1;
}
