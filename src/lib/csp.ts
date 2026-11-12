/**
 * S3. Content Security Policy.
 * Páginas dinâmicas: nonce por requisição + 'strict-dynamic' (sem 'unsafe-inline' para scripts).
 * Páginas estáticas (geradas no build, sem dado de usuário): sem nonce possível, então 'unsafe-inline' nos scripts.
 * Estilos: 'unsafe-inline' (o CSS vai embutido no HTML, experimental.inlineCss).
 * Turnstile (captcha) liberado em script/frame/connect.
 */
const TURNSTILE = "https://challenges.cloudflare.com";

/** Rotas geradas no build (○ no `next build`). Manter em dia ao criar páginas estáticas. */
export const ROTAS_ESTATICAS = new Set(["/", "/precos", "/assessorias", "/guias", "/privacidade", "/termos"]);

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
