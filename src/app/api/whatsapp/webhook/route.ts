import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ehPedidoParaSair, finalTelefone, mesmoTelefone } from "@/lib/telefone";

/** Verificação do webhook pela Meta. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && process.env.WHATSAPP_VERIFY_TOKEN && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "");
  }
  return new NextResponse("Proibido.", { status: 403 });
}

/** Mensagens recebidas: "SAIR" encerra os avisos daquele número (Produto e experiência, Regras do WhatsApp). */
export async function POST(req: NextRequest) {
  const corpo = await req.text();
  const segredo = process.env.WHATSAPP_APP_SECRET;
  if (segredo) {
    const assinatura = req.headers.get("x-hub-signature-256") ?? "";
    const esperado = `sha256=${crypto.createHmac("sha256", segredo).update(corpo).digest("hex")}`;
    if (assinatura.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperado))) {
      return new NextResponse("Assinatura inválida.", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return new NextResponse("WHATSAPP_APP_SECRET não configurado.", { status: 500 });
  }
  type Msg = { from: string; type: string; text?: { body: string } };
  let dados: { entry?: { changes?: { value?: { messages?: Msg[] } }[] }[] };
  try {
    dados = JSON.parse(corpo);
  } catch {
    return new NextResponse("Corpo inválido.", { status: 400 });
  }
  const msgs = dados.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];
  for (const m of msgs) {
    // "SAIR", "PARAR" ou "STOP" (C5); o número é comparado com e sem o 9 depois do DDD.
    if (m.type !== "text" || !ehPedidoParaSair(m.text?.body)) continue;
    const finais = finalTelefone(m.from); // 8 últimos dígitos: comuns às formas com e sem o 9
    const usuarios = await db.usuario.findMany({ where: { whatsapp: { endsWith: finais } } });
    for (const u of usuarios) if (mesmoTelefone(u.whatsapp, m.from)) await db.usuario.update({ where: { id: u.id }, data: { whatsappConsentEm: null } });
    const leads = await db.lead.findMany({ where: { whatsapp: { endsWith: finais } } });
    for (const l of leads) if (mesmoTelefone(l.whatsapp, m.from)) await db.lead.update({ where: { id: l.id }, data: { whatsapp: null, consentimentoAvisos: false } });
  }
  return NextResponse.json({ ok: true });
}
