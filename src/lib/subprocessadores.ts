/**
 * C8. Subprocessadores realmente ligados, lidos do ambiente (sem nomes inventados). Aparecem na política de
 * privacidade. A Anthropic só entra quando uma chave de IA está ligada, com a menção à transferência
 * internacional (LGPD, art. 33).
 */
export interface Subprocessador {
  papel: string;
  quem: string;
  internacional?: boolean;
}

const host = (url: string | undefined) => {
  try {
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
};

export function iaLigadaParaAlguem() {
  return !!process.env.ANTHROPIC_API_KEY && (process.env.IA_LEITURA_PLANILHA === "true" || process.env.IA_LEITURA_CONVENCAO === "true");
}

export function subprocessadores(): Subprocessador[] {
  const e = process.env;
  const out: Subprocessador[] = [];
  out.push({ papel: "Hospedagem do sistema e do banco de dados", quem: e.HOSPEDAGEM_PROVEDOR?.trim() || "provedor de hospedagem informado na contratação" });
  if (e.ARMAZENAMENTO === "s3") out.push({ papel: "Armazenamento dos arquivos enviados", quem: host(e.S3_ENDPOINT) ?? "Amazon S3" });
  if (e.SMTP_URL) out.push({ papel: "Envio de e-mails", quem: host(e.SMTP_URL.replace(/^smtps?:/, "http:")) ?? "provedor de e-mail" });
  if (e.TURNSTILE_SECRET_KEY) out.push({ papel: "Proteção contra robôs (captcha)", quem: "Cloudflare Turnstile", internacional: true });
  if (e.GOOGLE_CLIENT_ID) out.push({ papel: "Entrar com o Google", quem: "Google", internacional: true });
  if (e.ASAAS_API_KEY) out.push({ papel: "Cobrança e emissão de boletos e Pix", quem: "Asaas" });
  if (e.WHATSAPP_TOKEN) out.push({ papel: "Avisos por WhatsApp", quem: "Meta (WhatsApp Business)", internacional: true });
  if (iaLigadaParaAlguem()) out.push({ papel: "Leitura de planilhas e convenções em PDF com IA", quem: "Anthropic", internacional: true });
  return out;
}
