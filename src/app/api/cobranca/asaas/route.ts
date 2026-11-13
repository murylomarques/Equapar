import { NextResponse, type NextRequest } from "next/server";
import { eventoAsaas, tokenWebhookValido } from "@/lib/cobranca";
import { processarEventoPagamento } from "@/lib/cobranca-servidor";
import { registrar } from "@/lib/registro";

/**
 * Fase 1 (4.2). Webhook do Asaas. Confere o cabeçalho `asaas-access-token` (ASAAS_WEBHOOK_TOKEN) antes de
 * ler o corpo; cada evento é processado uma vez só (EventoCobranca). Responde 200 a eventos que não
 * interessam, para o Asaas não reenviar.
 */
export async function POST(req: NextRequest) {
  if (!tokenWebhookValido(req.headers.get("asaas-access-token"), process.env.ASAAS_WEBHOOK_TOKEN)) return new NextResponse("Não autorizado.", { status: 401 });
  let corpo: { id?: string; event?: string; payment?: { id?: string; externalReference?: string | null } };
  try {
    corpo = await req.json();
  } catch {
    return new NextResponse("Corpo inválido.", { status: 400 });
  }
  const evento = corpo.event ? eventoAsaas(corpo.event) : null;
  if (!evento || !corpo.payment?.id) return NextResponse.json({ ok: true, ignorado: corpo.event ?? null });
  const r = await processarEventoPagamento({
    gatewayId: corpo.payment.id,
    faturaId: corpo.payment.externalReference ?? undefined,
    evento,
    eventoId: corpo.id,
    tipoOriginal: corpo.event,
  });
  registrar("info", "webhook_cobranca", { evento: corpo.event, resultado: r });
  return NextResponse.json({ ok: true, resultado: r });
}
