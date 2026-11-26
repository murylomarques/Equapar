/** Papéis e permissões (puro, sem sessão nem banco): a mesma tabela que o servidor usa em exigir(). */
import type { Papel } from "@prisma/client";
import { situacaoEfetiva } from "./planos";

export type Acao =
  | "ver"
  | "editar_contratos"
  | "editar_pedidos"
  | "aprovar_memoria"
  | "registrar_financeiro"
  | "gerenciar_conta";

const PERMISSOES: Record<Papel, Acao[]> = {
  DONO: ["ver", "editar_contratos", "editar_pedidos", "aprovar_memoria", "registrar_financeiro", "gerenciar_conta"],
  GERENTE: ["ver", "editar_contratos", "editar_pedidos", "registrar_financeiro"],
  CONTADOR: ["ver", "editar_pedidos", "aprovar_memoria"],
  LEITURA: ["ver"],
};

export const NOME_PAPEL: Record<Papel, string> = {
  DONO: "Dono",
  GERENTE: "Gerente de contratos",
  CONTADOR: "Contador",
  LEITURA: "Leitura",
};

export function pode(papel: Papel, acao: Acao) {
  return PERMISSOES[papel].includes(acao);
}

/**
 * Conta só para consulta por falta de pagamento (passou a carência): só "ver" e "gerenciar a conta" continuam
 * (dá para pagar e exportar). A mesma regra de exigir() no servidor; as telas usam podeNaConta() para esconder
 * o que seria recusado.
 */
export function contaSoConsulta(conta: { situacaoCobranca: string; carenciaAte: Date | null }, agora = new Date()) {
  return situacaoEfetiva(conta.situacaoCobranca, conta.carenciaAte, agora) === "SOMENTE_LEITURA";
}

/** O papel permite e a conta não está só para consulta. Decide o que a tela mostra; o servidor confere em exigir(). */
export function podeNaConta(ctx: { papel: Papel; conta: { situacaoCobranca: string; carenciaAte: Date | null } }, acao: Acao) {
  if (acao !== "ver" && acao !== "gerenciar_conta" && contaSoConsulta(ctx.conta)) return false;
  return pode(ctx.papel, acao);
}
