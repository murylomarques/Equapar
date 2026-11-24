/** Papéis e permissões (puro, sem sessão nem banco): a mesma tabela que o servidor usa em exigir(). */
import type { Papel } from "@prisma/client";

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
