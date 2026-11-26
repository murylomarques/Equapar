import { NextResponse, type NextRequest } from "next/server";
import { contexto } from "@/lib/auth";
import { relatorioAnoPdf } from "@/lib/relatorios-pdf";
import { cabecalhoAnexo } from "@/lib/arquivo-tipo";
import { hojeUTC } from "@/lib/format";

/** "Relatório do ano (PDF)": qualquer papel que vê a conta pode baixar. */
export async function GET(req: NextRequest) {
  const ctx = await contexto();
  const ano = Number(req.nextUrl.searchParams.get("ano") ?? hojeUTC().getUTCFullYear());
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return new NextResponse("Ano inválido.", { status: 400 });
  try {
    const pdf = await relatorioAnoPdf(ctx, ano);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "content-type": "application/pdf", "content-disposition": cabecalhoAnexo(`relatorio-${ano}.pdf`), "cache-control": "no-store" },
    });
  } catch (e) {
    console.error(e);
    return new NextResponse("Não foi possível montar o relatório agora. Tente de novo; se continuar, fale com o suporte.", { status: 500 });
  }
}
