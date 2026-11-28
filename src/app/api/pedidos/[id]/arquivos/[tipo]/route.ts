import { NextResponse } from "next/server";
import { contexto, pedidoDaConta } from "@/lib/auth";
import { fundamentacaoPdf, memoriaPdf, minutaAditivoPdf, oficioDocx, oficioPdf, pacoteZip, planilhaXlsx, retroativoPdf } from "@/lib/documentos";
import { cabecalhoAnexo } from "@/lib/arquivo-tipo";
import { ErroUsuario } from "@/lib/acao";
import { db } from "@/lib/db";
import { validarDocumentoFinal } from "@/lib/pedido-final";

const TIPOS = {
  "oficio.docx": { fn: oficioDocx, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", nome: "oficio" },
  "oficio.pdf": { fn: oficioPdf, mime: "application/pdf", nome: "oficio" },
  "planilha.xlsx": { fn: planilhaXlsx, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nome: "planilha" },
  "memoria.pdf": { fn: memoriaPdf, mime: "application/pdf", nome: "memoria-de-calculo" },
  "aditivo.pdf": { fn: minutaAditivoPdf, mime: "application/pdf", nome: "minuta-aditivo" },
  "fundamentacao.pdf": { fn: fundamentacaoPdf, mime: "application/pdf", nome: "fundamentacao-normativa" },
  "retroativo.pdf": { fn: retroativoPdf, mime: "application/pdf", nome: "demonstrativo-retroativo" },
  "pacote.zip": { fn: pacoteZip, mime: "application/zip", nome: "pedido-completo" },
} as const;

export async function GET(req: Request, { params }: { params: Promise<{ id: string; tipo: string }> }) {
  const { id, tipo } = await params;
  const t = TIPOS[tipo as keyof typeof TIPOS];
  if (!t) return new NextResponse("Arquivo desconhecido.", { status: 404 });
  const ctx = await contexto();
  const p = await pedidoDaConta(ctx, id).catch(() => null);
  if (!p) return new NextResponse("Pedido não encontrado.", { status: 404 });
  try {
    const rascunho = new URL(req.url).searchParams.get("rascunho") === "1";
    if (!rascunho) {
      const completo = await db.pedido.findUnique({ where: { id }, include: { documentos: true } });
      if (!completo) return new NextResponse("Pedido não encontrado.", { status: 404 });
      await validarDocumentoFinal(completo);
    }
    const buf = tipo === "pacote.zip" ? await pacoteZip(id, ctx.conta.id, { rascunho }) : await t.fn(id, ctx.conta.id);
    const ext = tipo.split(".").pop();
    const n = p.contrato.numero.replace(/[^\w.-]+/g, "-");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": t.mime,
        "content-disposition": cabecalhoAnexo(`${rascunho ? "RASCUNHO-" : ""}${t.nome}-contrato-${n}.${ext}`),
        "cache-control": "no-store",
        "x-equapar-versao": rascunho ? "RASCUNHO" : "FINAL",
      },
    });
  } catch (e) {
    // S9: só a mensagem pensada para a pessoa vai na resposta; o detalhe técnico fica no log
    if (e instanceof ErroUsuario) return new NextResponse(e.message, { status: 409 });
    console.error(e);
    return new NextResponse("Não foi possível montar este arquivo agora. Tente de novo; se continuar, fale com o suporte.", { status: 500 });
  }
}
