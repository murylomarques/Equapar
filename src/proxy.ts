import { NextResponse, type NextRequest } from "next/server";
import { montarCsp, rotaEstatica } from "@/lib/csp";
import { rotaEscondida } from "@/lib/chaves";

/** S3: CSP por requisição. Páginas dinâmicas ganham nonce; as estáticas, a política sem nonce. */
export function proxy(req: NextRequest) {
  // A6: chave esconde, nunca apaga. Rotas escondidas: 404 no site, Hoje dentro do app.
  const escondida = rotaEscondida(req.nextUrl.pathname);
  if (escondida === "hoje") return NextResponse.redirect(new URL("/app/hoje", req.url));
  if (escondida === "404") {
    // a página "não encontrada" é estática: CSP sem nonce, como as demais páginas geradas no build
    const r = NextResponse.rewrite(new URL("/_escondida", req.url), { status: 404 });
    r.headers.set("Content-Security-Policy", montarCsp(null));
    return r;
  }
  const estatica = rotaEstatica(req.nextUrl.pathname);
  const nonce = estatica ? null : Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = montarCsp(nonce);
  const cab = new Headers(req.headers);
  // 4.1.5: id da requisição para os logs (e devolvido na resposta para o suporte achar o caso)
  const requisicao = crypto.randomUUID();
  cab.set("x-request-id", requisicao);
  if (nonce) cab.set("x-nonce", nonce);
  cab.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: cab } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("x-request-id", requisicao);
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|equapar-logo).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
