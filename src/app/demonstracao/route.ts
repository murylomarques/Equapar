import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { criarSessao } from "@/lib/auth";
import { appUrl } from "@/lib/mensagens";
import { EMAIL_DEMO } from "@/lib/site";

/** "Ver a tela por dentro": entra numa conta de demonstração, só leitura, com dados fictícios. */
export async function GET(req: Request) {
  // Pré-carregamento (prefetch) nunca pode abrir sessão.
  const h = req.headers;
  if (h.get("next-router-prefetch") || h.get("purpose") === "prefetch" || (h.get("sec-purpose") ?? "").includes("prefetch")) {
    return new NextResponse(null, { status: 204 });
  }
  const u = await db.usuario.findUnique({ where: { email: EMAIL_DEMO }, include: { membros: true } });
  if (!u || !u.membros.length) return NextResponse.redirect(appUrl("/?demo=indisponivel"));
  await criarSessao(u.id, { contaId: u.membros[0].contaId });
  return NextResponse.redirect(appUrl("/app/hoje"));
}
