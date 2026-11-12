"use client";
import Script from "next/script";

/** S2. Widget do Turnstile dentro do formulário. Sem NEXT_PUBLIC_TURNSTILE_SITE_KEY (simulação), não mostra nada. */
export function Captcha() {
  const chave = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!chave) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      <div className="cf-turnstile mt-8" data-sitekey={chave} data-language="pt-br" />
    </>
  );
}
