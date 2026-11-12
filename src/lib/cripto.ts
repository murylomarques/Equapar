import crypto from "node:crypto";

function chave() {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 32) throw new Error("APP_SECRET ausente ou curto. Veja o .env.example.");
  return crypto.createHash("sha256").update(s).digest();
}

export function cifrar(texto: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", chave(), iv);
  const enc = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decifrar(payload: string) {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = crypto.createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export function sha256(v: string) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

export function tokenAleatorio(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function assinar(valor: string) {
  const mac = crypto.createHmac("sha256", chave()).update(valor).digest("base64url");
  return `${valor}.${mac}`;
}

export function verificarAssinatura(assinado: string): string | null {
  const i = assinado.lastIndexOf(".");
  if (i < 0) return null;
  const valor = assinado.slice(0, i);
  const esperado = assinar(valor);
  const a = Buffer.from(esperado);
  const b = Buffer.from(assinado);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? valor : null;
}
