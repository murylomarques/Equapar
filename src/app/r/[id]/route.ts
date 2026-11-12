import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/mensagens";

/** Link rastreado dos avisos: registra aviso_clicado (sem dado pessoal) e redireciona só para dentro do sistema. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const para = req.nextUrl.searchParams.get("para") ?? "/app/hoje";
  const destino = para.startsWith("/") && !para.startsWith("//") ? para : "/app/hoje";
  const aviso = await db.aviso.findUnique({ where: { id }, select: { tipo: true, canal: true } });
  if (aviso) await db.evento.create({ data: { nome: "aviso_clicado", props: { tipo: aviso.tipo, canal: aviso.canal } } });
  return NextResponse.redirect(appUrl(destino));
}
