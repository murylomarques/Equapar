import { NextResponse, type NextRequest } from "next/server";
import { contexto } from "@/lib/auth";
import { casoProntoPdf, dadosCasoPronto } from "@/lib/relatorios-pdf";
import { textoCasoPronto } from "@/lib/relatorios";
import { cabecalhoAnexo } from "@/lib/arquivo-tipo";
import { ErroUsuario } from "@/lib/acao";

/** "Caso pronto" de um pedido recebido: PDF de uma página ou texto (Markdown). Anônimo por padrão. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto();
  const formato = req.nextUrl.searchParams.get("formato") === "md" ? "md" : "pdf";
  const identificado = req.nextUrl.searchParams.get("identificado") === "1";
  const nome = `caso-${identificado ? "identificado" : "anonimo"}-rascunho`;
  try {
    if (formato === "md") {
      const { dados } = await dadosCasoPronto(ctx, id);
      return new NextResponse(textoCasoPronto(dados, { identificado }).markdown, {
        headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": cabecalhoAnexo(`${nome}.md`), "cache-control": "no-store" },
      });
    }
    const pdf = await casoProntoPdf(ctx, id, identificado);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "content-type": "application/pdf", "content-disposition": cabecalhoAnexo(`${nome}.pdf`), "cache-control": "no-store" },
    });
  } catch (e) {
    if (e instanceof ErroUsuario) return new NextResponse(e.message, { status: 409 });
    console.error(e);
    return new NextResponse("Não foi possível montar o caso agora. Tente de novo; se continuar, fale com o suporte.", { status: 500 });
  }
}
