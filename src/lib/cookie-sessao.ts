/**
 * S8. Nome e segurança do cookie de sessão. Em produção com HTTPS, o prefixo __Host- obriga o
 * navegador a só aceitar o cookie com Secure, path=/ e sem Domain (não vaza para subdomínios).
 */
export function opcoesCookieSessao() {
  const https = process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https://");
  return { nome: https ? "__Host-eq_sessao" : "eq_sessao", secure: https };
}
