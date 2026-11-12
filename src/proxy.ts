import { NextResponse, type NextRequest } from "next/server";
import { montarCsp, ROTAS_ESTATICAS } from "@/lib/csp";

/** S3: CSP por requisição. Páginas dinâmicas ganham nonce; as estáticas, a política sem nonce. */
export function proxy(req: NextRequest) {
  const estatica = ROTAS_ESTATICAS.has(req.nextUrl.pathname);
  const nonce = estatica ? null : Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = montarCsp(nonce);
  const cab = new Headers(req.headers);
  if (nonce) cab.set("x-nonce", nonce);
  cab.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: cab } });
  res.headers.set("Content-Security-Policy", csp);
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
