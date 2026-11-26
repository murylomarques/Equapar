import { NextResponse } from "next/server";
import { contexto } from "@/lib/auth";
import { resumoSocioPdf } from "@/lib/relatorios-pdf";
import { cabecalhoAnexo } from "@/lib/arquivo-tipo";
import { hojeUTC, paraInputData } from "@/lib/format";

/** "Resumo para o sócio (PDF)": qualquer papel que vê a conta pode baixar. */
export async function GET() {
  const ctx = await contexto();
  try {
    const pdf = await resumoSocioPdf(ctx);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "content-type": "application/pdf", "content-disposition": cabecalhoAnexo(`resumo-para-o-socio-${paraInputData(hojeUTC())}.pdf`), "cache-control": "no-store" },
    });
  } catch (e) {
    console.error(e);
    return new NextResponse("Não foi possível montar o resumo agora. Tente de novo; se continuar, fale com o suporte.", { status: 500 });
  }
}
