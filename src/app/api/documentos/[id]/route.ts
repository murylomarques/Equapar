import { NextResponse } from "next/server";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { lerArquivo, linkTemporario } from "@/lib/storage";
import { cabecalhoAnexo } from "@/lib/arquivo-tipo";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto();
  const d = await db.documento.findFirst({
    where: {
      id,
      OR: [
        { contrato: { empresa: { contaId: ctx.conta.id } } },
        { pedido: { contrato: { empresa: { contaId: ctx.conta.id } } } },
        { convencao: { contaId: ctx.conta.id } },
      ],
    },
  });
  if (!d) return new NextResponse("Documento não encontrado.", { status: 404 });
  // 5.5: PDF pode abrir no navegador (?ver=1), para o link levar à página da convenção; o resto sempre baixa
  const inline = new URL(req.url).searchParams.get("ver") === "1" && d.mime === "application/pdf";
  // S3: link assinado de 5 minutos, direto do bucket privado (a permissão já foi conferida acima)
  const link = await linkTemporario(d.caminho, d.nome, inline).catch(() => null);
  if (link) return NextResponse.redirect(link, { headers: { "cache-control": "no-store" } });
  try {
    const buf = await lerArquivo(d.caminho);
    return new NextResponse(new Uint8Array(buf), {
      headers: { "content-type": d.mime, "content-disposition": inline ? cabecalhoAnexo(d.nome).replace(/^attachment/, "inline") : cabecalhoAnexo(d.nome), "cache-control": "no-store" },
    });
  } catch {
    return new NextResponse("O arquivo não está mais no armazenamento.", { status: 410 });
  }
}
