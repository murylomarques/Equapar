import { NextResponse, type NextRequest } from "next/server";
import { cnpjValido, soDigitos } from "@/lib/cnpj";
import { registrarEvento } from "@/lib/eventos";
import { consultarPncp, PncpIndisponivel } from "@/lib/pncp";

/** Consulta do Raio-X para a tela (JSON). Só dados públicos do PNCP; registros de pessoa física já vêm descartados. */
export async function GET(req: NextRequest) {
  const cnpj = soDigitos(req.nextUrl.searchParams.get("cnpj") ?? "");
  if (!cnpjValido(cnpj)) return NextResponse.json({ erro: "cnpj" }, { status: 400 });
  await registrarEvento("raiox_consultado");
  try {
    const r = await consultarPncp(cnpj);
    await registrarEvento("raiox_resultado", { contratos: r.contratos.length });
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof PncpIndisponivel) return NextResponse.json({ erro: "pncp" }, { status: 503 });
    throw e;
  }
}
