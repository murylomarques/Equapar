/**
 * Regras do pedido que não dependem de banco nem de sessão (testáveis em unidade).
 * As ações de servidor em app/app/pedidos/acoes.ts usam estas funções.
 */
import { Prisma } from "@prisma/client";

type PedidoBase = {
  planilhaAgora: unknown;
  passoAtual: number;
  memoriaAprovadaEm: Date | null;
  estado: string;
};

/**
 * C1. Trocar a planilha atual (envio de arquivo ou modelo em branco).
 * Se já existe planilha nova (passo 3), ela é refeita a partir da atual no passo 2:
 * apaga a planilha nova e os totais gravados, desfaz a aprovação e volta ao passo 2.
 * `precisaConfirmar` diz se a tela tem de pedir confirmação antes.
 */
export function aoTrocarPlanilhaAtual(p: PedidoBase): { precisaConfirmar: boolean; data: Prisma.PedidoUpdateInput } {
  const temNova = p.planilhaAgora !== null && p.planilhaAgora !== undefined;
  if (!temNova) return { precisaConfirmar: false, data: {} };
  return {
    precisaConfirmar: true,
    data: {
      planilhaAgora: Prisma.DbNull,
      diferencaMensal: null,
      diferencaRetroativa: null,
      passoAtual: Math.min(p.passoAtual, 2),
      ...dadosInvalidarAprovacao(p),
    },
  };
}

/** C2. Campos que desfazem a aprovação da memória (vazio se não havia aprovação nem pedido gerado). */
export function dadosInvalidarAprovacao(p: Pick<PedidoBase, "memoriaAprovadaEm" | "estado">): Prisma.PedidoUpdateInput {
  const data: Prisma.PedidoUpdateInput = {};
  if (p.memoriaAprovadaEm) Object.assign(data, { memoriaAprovadaEm: null, memoriaAprovadaPor: null });
  if (p.estado === "CALCULO_VALIDADO") Object.assign(data, { estado: "EM_ANALISE", geradoEm: null });
  return data;
}
