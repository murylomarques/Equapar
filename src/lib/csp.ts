/**
 * S3. Content Security Policy.
 * Páginas dinâmicas: nonce por requisição + 'strict-dynamic' (sem 'unsafe-inline' para scripts).
 * Páginas estáticas (geradas no build, sem dado de usuário): sem nonce possível, então 'unsafe-inline' nos scripts.
 * Estilos: 'unsafe-inline' (o CSS vai embutido no HTML, experimental.inlineCss).
 * Turnstile (captcha) liberado em script/frame/connect.
 */
const TURNSTILE = "https://challenges.cloudflare.com";

/**
 * Rotas geradas no build (estão em .next/prerender-manifest.json). O teste e2e/bloqueadoras/s3-cabecalhos.mjs
 * confere esta lista contra o build: página estática nova sem entrar aqui faz o teste falhar.
 */
export const ROTAS_ESTATICAS = new Set(["/", "/precos", "/assessorias", "/guias", "/privacidade", "/termos", "/esqueci-senha"]);

export function rotaEstatica(caminho: string) {
  return ROTAS_ESTATICAS.has(caminho) || caminho.startsWith("/guias/");
}

export function montarCsp(nonce: string | null, dev = process.env.NODE_ENV === "development") {
  const script = nonce ? `'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE}` : `'self' 'unsafe-inline' ${TURNSTILE}`;
  return [
    "default-src 'self'",
    `script-src ${script}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' ${TURNSTILE}`,
    `frame-src ${TURNSTILE}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...((process.env.APP_URL ?? "").startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
