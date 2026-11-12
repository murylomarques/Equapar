import "server-only";

/**
 * S2. Captcha (Cloudflare Turnstile). Sem TURNSTILE_SECRET_KEY fica em SIMULAÇÃO: aceita e registra no log.
 * Ligar a chave real é decisão do dono (trava 5).
 */
export function captchaAtivo() {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verificarCaptcha(token: string | null | undefined, ip?: string | null): Promise<boolean> {
  if (!captchaAtivo()) {
    console.info("[captcha SIMULADO] aceito sem verificação (TURNSTILE_SECRET_KEY ausente)");
    return true;
  }
  if (!token) return false;
  const corpo = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token, ...(ip ? { remoteip: ip } : {}) });
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: corpo, signal: AbortSignal.timeout(8000) });
    const d = (await r.json()) as { success?: boolean };
    return !!d.success;
  } catch {
    return false;
  }
}
