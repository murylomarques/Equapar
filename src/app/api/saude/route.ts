import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Fase 1 (4.1.4). Saúde para o balanceador e o monitor de disponibilidade: confere o banco (e a fila,
 * quando ela existir). 200 se tudo responde; 503 se alguma parte falha. Sem detalhe técnico na resposta.
 */
export async function GET() {
  const inicio = Date.now();
  let banco: "ok" | "falha" = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (e) {
    console.error(JSON.stringify({ nivel: "erro", evento: "saude_banco", erro: String((e as Error)?.message ?? e).slice(0, 200) }));
    banco = "falha";
  }
  const ok = banco === "ok";
  return NextResponse.json({ ok, banco, ms: Date.now() - inicio }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
