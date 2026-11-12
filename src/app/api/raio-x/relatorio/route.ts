import { NextResponse, type NextRequest } from "next/server";
import { verificarAssinatura } from "@/lib/cripto";
import { raioXPdf } from "@/lib/documentos";
import { consultarPncp, PncpIndisponivel } from "@/lib/pncp";
import { cabecalhoAnexo } from "@/lib/arquivo-tipo";

export async function GET(req: NextRequest) {
  const v = verificarAssinatura(req.nextUrl.searchParams.get("t") ?? "");
  if (!v?.startsWith("raiox:")) return new NextResponse("Link inválido.", { status: 400 });
  const cnpj = v.slice(6);
  try {
    const r = await consultarPncp(cnpj);
    const pdf = await raioXPdf(r);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "content-type": "application/pdf", "content-disposition": cabecalhoAnexo(`raio-x-${cnpj}.pdf`) },
    });
  } catch (e) {
    if (e instanceof PncpIndisponivel) return new NextResponse("O PNCP não respondeu agora. Tente de novo em alguns minutos.", { status: 503 });
    throw e;
  }
}
