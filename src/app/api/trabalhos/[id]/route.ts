import { NextResponse } from "next/server";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { lerArquivo } from "@/lib/storage";
import { cabecalhoAnexo } from "@/lib/arquivo-tipo";

/** Download do resultado de uma tarefa em segundo plano (só quem pediu). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto();
  const t = await db.trabalhoFundo.findFirst({ where: { id, usuarioId: ctx.usuario.id, contaId: ctx.conta.id, status: "PRONTO" } });
  if (!t?.caminho) return new NextResponse("Arquivo não encontrado.", { status: 404 });
  if (Date.now() - (t.concluidoEm ?? t.criadoEm).getTime() > 7 * 86_400_000) return new NextResponse("Este arquivo expirou. Gere uma nova exportação em Configurações › Dados.", { status: 410 });
  try {
    const buf = await lerArquivo(t.caminho);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": cabecalhoAnexo(`equapar-exportacao-${(t.concluidoEm ?? t.criadoEm).toISOString().slice(0, 10)}.zip`),
        "cache-control": "no-store",
      },
    });
  } catch {
    return new NextResponse("O arquivo não está mais disponível. Gere uma nova exportação.", { status: 410 });
  }
}
