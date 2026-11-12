import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { tokenAleatorio } from "@/lib/cripto";
import { appUrl } from "@/lib/mensagens";

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID) return NextResponse.redirect(appUrl("/entrar?erro=google"));
  const state = tokenAleatorio(16);
  (await cookies()).set("eq_oauth", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/", secure: process.env.NODE_ENV === "production" });
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: appUrl("/api/auth/google/callback"),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
}
