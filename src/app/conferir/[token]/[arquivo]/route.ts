import { NextResponse, type NextRequest } from "next/server";
import { memoriaPdf, planilhaXlsx } from "@/lib/documentos";
import { cabecalhoAnexo } from "@/lib/arquivo-tipo";
import { ErroUsuario } from "@/lib/acao";
import { aprovacaoValida } from "@/lib/pedido-regras";
import { MENSAGEM_CONFERENCIA } from "@/lib/conferencia";
import { abrirConferencia, registrarAcessoConferencia } from "@/lib/conferencia-servidor";

const ARQUIVOS = {
  "memoria.pdf": { fn: memoriaPdf, mime: "application/pdf", nome: "memoria-de-calculo", oque: "baixou a memória de cálculo (PDF)" },
  "planilha.xlsx": { fn: planilhaXlsx, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nome: "planilha", oque: "baixou a planilha (Excel)" },
} as const;

/** Downloads da conferência pelo contador: só a memória (PDF) e a planilha, com o mesmo link assinado da página. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; arquivo: string }> }) {
  const { token, arquivo } = await params;
  const a = ARQUIVOS[arquivo as keyof typeof ARQUIVOS];
  if (!a) return new NextResponse("Arquivo desconhecido.", { status: 404 });
  const aberto = await abrirConferencia(token, req.headers);
  if (aberto.erro) {
    if (aberto.erro === "limite") return new NextResponse("Muitos acessos a este link hoje. Tente de novo amanhã.", { status: 429 });
    return new NextResponse(MENSAGEM_CONFERENCIA[aberto.erro], { status: 404 });
  }
  const { p } = aberto;
  try {
    const buf = await a.fn(p.id, p.contrato.empresa.contaId);
    await registrarAcessoConferencia(p, a.oque);
    const ext = arquivo.split(".").pop();
    const n = p.contrato.numero.replace(/[^\w.-]+/g, "-");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": a.mime,
        "content-disposition": cabecalhoAnexo(`${aprovacaoValida(p) ? "" : "RASCUNHO-"}${a.nome}-contrato-${n}.${ext}`),
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    });
  } catch (e) {
    if (e instanceof ErroUsuario) return new NextResponse(e.message, { status: 409 });
    console.error(e);
    return new NextResponse("Não foi possível montar este arquivo agora. Tente de novo mais tarde.", { status: 500 });
  }
}
