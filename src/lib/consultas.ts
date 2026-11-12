import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { escopoContratos, type Contexto } from "./auth";

export async function contratosDoContexto(ctx: Contexto, filtro: Prisma.ContratoWhereInput = {}) {
  return db.contrato.findMany({
    where: { AND: [escopoContratos(ctx), filtro] },
    include: { convencao: true, pedidos: { orderBy: { criadoEm: "desc" } }, empresa: true },
    orderBy: { vigenciaFim: "asc" },
  });
}

export type ContratoCompleto = Awaited<ReturnType<typeof contratosDoContexto>>[number];

export function escopoPedidos(ctx: Contexto): Prisma.PedidoWhereInput {
  return { contrato: escopoContratos(ctx) };
}
