/**
 * S12. Link de convite: vale 7 dias e só enquanto a pessoa convidada ainda não definiu a senha
 * (leva a impressão do hash atual, como o link de redefinição). Sem tabela nova.
 */
import crypto from "node:crypto";
import { assinar, verificarAssinatura } from "./cripto";

const VALIDADE_MS = 7 * 86_400_000;
const impressao = (h: string | null) => crypto.createHash("sha256").update(`convite:${h ?? "-"}`).digest("hex").slice(0, 16);

export function tokenConvite(u: { id: string; senhaHash: string | null }, contaId: string, agora = Date.now()) {
  return assinar(`convite|${u.id}|${contaId}|${agora + VALIDADE_MS}|${impressao(u.senhaHash)}`);
}

export function lerTokenConvite(token: string): { usuarioId: string; contaId: string; vence: number; imp: string } | null {
  const v = verificarAssinatura(token);
  const [tipo, usuarioId, contaId, vence, imp] = v?.split("|") ?? [];
  return tipo === "convite" && usuarioId && contaId && Number(vence) ? { usuarioId, contaId, vence: Number(vence), imp } : null;
}

export function conviteValido(t: ReturnType<typeof lerTokenConvite>, u: { id: string; senhaHash: string | null } | null, agora = Date.now()): "ok" | "invalido" | "vencido" | "usado" {
  if (!t || !u || t.usuarioId !== u.id) return "invalido";
  if (t.vence < agora) return "vencido";
  if (t.imp !== impressao(u.senhaHash)) return "usado";
  return "ok";
}
