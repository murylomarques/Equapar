import { NextResponse, type NextRequest } from "next/server";
import { rodarAvisos } from "@/lib/avisos";

/** Para agendador externo (ex.: cron de hora em hora). Exige o header Authorization: Bearer CRON_SECRET. */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) return new NextResponse("Não autorizado.", { status: 401 });
  return NextResponse.json(await rodarAvisos());
}
