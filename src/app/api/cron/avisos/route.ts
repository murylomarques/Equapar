import { NextResponse, type NextRequest } from "next/server";
import { rodarAvisos } from "@/lib/avisos";
import { renovarAssinaturas } from "@/lib/cobranca-servidor";
import { expirarReservasIa } from "@/lib/ia-orcamento";

/** Para agendador externo (ex.: cron de hora em hora). Exige o header Authorization: Bearer CRON_SECRET. */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) return new NextResponse("Não autorizado.", { status: 401 });
  const avisos = await rodarAvisos();
  // P0: a mesma chamada de hora em hora mantém as assinaturas e as reservas de IA em dia
  return NextResponse.json({ ...avisos, assinaturas: await renovarAssinaturas(), reservasIaExpiradas: await expirarReservasIa() });
}
