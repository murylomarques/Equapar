/**
 * C7. Confirmação de e-mail por link assinado (sem tabela nova): o token leva o id da pessoa,
 * o e-mail e o vencimento (24 horas), assinados com APP_SECRET. Trocar o e-mail invalida o link.
 */
import { assinar, verificarAssinatura } from "./cripto";

const VALIDADE_MS = 24 * 3_600_000;

export function tokenConfirmacao(usuarioId: string, email: string, agora = Date.now()) {
  return assinar(`confirmar-email|${usuarioId}|${email.toLowerCase()}|${agora + VALIDADE_MS}`);
}

/** Devolve { usuarioId, email } se o token é válido e não venceu; senão, o motivo. */
export function lerTokenConfirmacao(token: string, agora = Date.now()): { usuarioId: string; email: string } | { erro: "invalido" | "vencido" } {
  const valor = verificarAssinatura(token);
  if (!valor) return { erro: "invalido" };
  const [tipo, usuarioId, email, vence] = valor.split("|");
  if (tipo !== "confirmar-email" || !usuarioId || !email || !Number(vence)) return { erro: "invalido" };
  if (Number(vence) < agora) return { erro: "vencido" };
  return { usuarioId, email };
}
