/**
 * S11. Link de redefinição de senha, sem tabela nova: assinado com APP_SECRET, vale 1 hora e leva uma
 * "impressão" do hash da senha atual. Quando a senha muda, a impressão muda e o link deixa de valer
 * (serve uma vez só).
 */
import crypto from "node:crypto";
import { assinar, verificarAssinatura } from "./cripto";

const VALIDADE_MS = 60 * 60_000;

function impressao(senhaHash: string | null) {
  return crypto.createHash("sha256").update(`senha:${senhaHash ?? "-"}`).digest("hex").slice(0, 16);
}

export function tokenRedefinicao(u: { id: string; senhaHash: string | null }, agora = Date.now()) {
  return assinar(`redefinir|${u.id}|${agora + VALIDADE_MS}|${impressao(u.senhaHash)}`);
}

/** Id da pessoa dona do token (para buscar no banco antes de conferir). */
export function idDoToken(token: string): string | null {
  const v = verificarAssinatura(token);
  const [tipo, id] = v?.split("|") ?? [];
  return tipo === "redefinir" && id ? id : null;
}

export function lerTokenRedefinicao(token: string, u: { id: string; senhaHash: string | null }, agora = Date.now()): { ok: true } | { erro: "invalido" | "vencido" | "usado" } {
  const v = verificarAssinatura(token);
  if (!v) return { erro: "invalido" };
  const [tipo, id, vence, imp] = v.split("|");
  if (tipo !== "redefinir" || id !== u.id || !Number(vence)) return { erro: "invalido" };
  if (Number(vence) < agora) return { erro: "vencido" };
  if (imp !== impressao(u.senhaHash)) return { erro: "usado" };
  return { ok: true };
}
