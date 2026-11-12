import { NextResponse } from "next/server";
import { contexto } from "@/lib/auth";
import { lerArquivo } from "@/lib/storage";

/** Pré-visualização do logo da assessoria (só para quem é da conta). */
export async function GET() {
  const ctx = await contexto();
  if (!ctx.conta.marcaLogo) return new NextResponse("Sem logo.", { status: 404 });
  try {
    const buf = await lerArquivo(ctx.conta.marcaLogo);
    const tipo = ctx.conta.marcaLogo.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": tipo, "cache-control": "private, no-store" } });
  } catch {
    return new NextResponse("Logo não encontrado.", { status: 404 });
  }
}
