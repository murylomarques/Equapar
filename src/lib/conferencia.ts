/**
 * Link de conferência para o contador: leitura da memória de cálculo de um pedido, sem conta, por link
 * assinado (sem tabela nova, como a confirmação de e-mail e o convite). O token leva o pedido, a conta,
 * quando foi emitido e o vencimento (14 dias), assinados com APP_SECRET.
 * Revogar: fica no histórico do pedido ("Revogou os links de conferência..."); todo link emitido antes
 * da última revogação deixa de valer. Assim não é preciso guardar cada link.
 */
import { assinar, verificarAssinatura } from "./cripto";

export const VALIDADE_CONFERENCIA_MS = 14 * 86_400_000;
export const ACAO_LINK_CRIADO = "Criou um link de conferência para o contador";
export const ACAO_LINK_REVOGADO = "Revogou os links de conferência para o contador";

export type TokenConferencia = { pedidoId: string; contaId: string; emitidoEm: number; vence: number };

/** Token para a URL (/conferir/<token>): o valor assinado em base64url, sem "|" nem "." soltos. */
export function tokenConferencia(pedidoId: string, contaId: string, agora = Date.now()) {
  return Buffer.from(assinar(`conferencia|${pedidoId}|${contaId}|${agora}|${agora + VALIDADE_CONFERENCIA_MS}`)).toString("base64url");
}

export function lerTokenConferencia(token: string): TokenConferencia | null {
  if (!token || token.length > 600 || !/^[\w-]+$/.test(token)) return null;
  const v = verificarAssinatura(Buffer.from(token, "base64url").toString("utf8"));
  const [tipo, pedidoId, contaId, emitido, vence] = v?.split("|") ?? [];
  if (tipo !== "conferencia" || !pedidoId || !contaId || !Number(emitido) || !Number(vence)) return null;
  return { pedidoId, contaId, emitidoEm: Number(emitido), vence: Number(vence) };
}

/** Situação do link: revogado vale para todo link emitido até a última revogação, inclusive. */
export function situacaoConferencia(t: TokenConferencia | null, revogadoEm: Date | null, agora = Date.now()): "ok" | "invalido" | "vencido" | "revogado" {
  if (!t) return "invalido";
  if (revogadoEm && t.emitidoEm <= revogadoEm.getTime()) return "revogado";
  if (t.vence < agora) return "vencido";
  return "ok";
}

/** Um link criado em `criadoEm` ainda está no prazo de 14 dias. */
export function linkAindaValido(criadoEm: Date, agora = Date.now()) {
  return criadoEm.getTime() + VALIDADE_CONFERENCIA_MS > agora;
}

export const MENSAGEM_CONFERENCIA = {
  invalido: "Este link de conferência não é válido. Confira se foi copiado inteiro.",
  vencido: "Este link de conferência venceu (vale 14 dias). Peça um novo a quem enviou.",
  revogado: "Este link de conferência foi desativado por quem enviou. Peça um novo, se precisar.",
} as const;
