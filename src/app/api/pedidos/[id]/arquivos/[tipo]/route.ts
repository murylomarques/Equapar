import { NextResponse } from "next/server";
import { contexto, pedidoDaConta } from "@/lib/auth";
import { memoriaPdf, minutaAditivoPdf, oficioDocx, oficioPdf, pacoteZip, planilhaXlsx } from "@/lib/documentos";
import { cabecalhoAnexo } from "@/lib/arquivo-tipo";
import { ErroUsuario } from "@/lib/acao";

const TIPOS = {
  "oficio.docx": { fn: oficioDocx, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", nome: "oficio" },
  "oficio.pdf": { fn: oficioPdf, mime: "application/pdf", nome: "oficio" },
  "planilha.xlsx": { fn: planilhaXlsx, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nome: "planilha" },
  "memoria.pdf": { fn: memoriaPdf, mime: "application/pdf", nome: "memoria-de-calculo" },
  "aditivo.pdf": { fn: minutaAditivoPdf, mime: "application/pdf", nome: "minuta-aditivo" },
  "pacote.zip": { fn: pacoteZip, mime: "application/zip", nome: "pedido-completo" },
} as const;

export async function GET(_: Request, { params }: { params: Promise<{ id: string; tipo: string }> }) {
  const { id, tipo } = await params;
  const t = TIPOS[tipo as keyof typeof TIPOS];
  if (!t) return new NextResponse("Arquivo desconhecido.", { status: 404 });
  const ctx = await contexto();
  const p = await pedidoDaConta(ctx, id).catch(() => null);
  if (!p) return new NextResponse("Pedido não encontrado.", { status: 404 });
  try {
    const buf = await t.fn(id, ctx.conta.id);
    const ext = tipo.split(".").pop();
    const n = p.contrato.numero.replace(/[^\w.-]+/g, "-");
    return new NextResponse(new Uint8Array(buf), {
      headers: { "content-type": t.mime, "content-disposition": cabecalhoAnexo(`${t.nome}-contrato-${n}.${ext}`), "cache-control": "no-store" },
    });
  } catch (e) {
    // S9: só a mensagem pensada para a pessoa vai na resposta; o detalhe técnico fica no log
    if (e instanceof ErroUsuario) return new NextResponse(e.message, { status: 409 });
    console.error(e);
    return new NextResponse("Não foi possível montar este arquivo agora. Tente de novo; se continuar, fale com o suporte.", { status: 500 });
  }
}
