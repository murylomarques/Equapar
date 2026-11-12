import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { criarSessao } from "@/lib/auth";
import { appUrl } from "@/lib/mensagens";

export async function GET(req: NextRequest) {
  const falha = () => NextResponse.redirect(appUrl("/entrar?erro=google"));
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const jar = await cookies();
  const esperado = jar.get("eq_oauth")?.value;
  jar.delete("eq_oauth");
  if (!code || !state || state !== esperado || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return falha();

  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: appUrl("/api/auth/google/callback"),
      grant_type: "authorization_code",
    }),
  });
  if (!tok.ok) return falha();
  const { access_token } = (await tok.json()) as { access_token: string };
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${access_token}` } });
  if (!info.ok) return falha();
  const perfil = (await info.json()) as { sub: string; email: string; email_verified: boolean; name?: string };
  if (!perfil.email_verified) return falha();

  const email = perfil.email.toLowerCase();
  let u = await db.usuario.findFirst({ where: { OR: [{ googleId: perfil.sub }, { email }] } });
  if (!u) u = await db.usuario.create({ data: { email, nome: perfil.name ?? email, googleId: perfil.sub } });
  else if (!u.googleId) u = await db.usuario.update({ where: { id: u.id }, data: { googleId: perfil.sub } });

  await criarSessao(u.id, { pendente2fa: u.totpAtivo });
  if (u.totpAtivo) return NextResponse.redirect(appUrl("/entrar/2fa"));
  const temConta = await db.membro.findFirst({ where: { usuarioId: u.id } });
  return NextResponse.redirect(appUrl(temConta ? "/app/hoje" : "/criar-conta?etapa=empresa"));
}
