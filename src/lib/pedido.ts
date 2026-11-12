import type { Pedido } from "@prisma/client";
import { calcularRetroativo, compararPlanilhas, VERSAO_REGRA, type Comparacao, type Retroativo } from "./calculo/motor";
import type { PlanilhaCustos } from "./calculo/tipos";
import { hojeUTC } from "./format";

export const PASSOS = ["Gatilho", "Planilha atual", "Novos custos", "Documentos", "Revisão"] as const;

export const NOME_GATILHO = {
  NOVA_CONVENCAO: "Nova convenção coletiva",
  ACORDO_DISSIDIO: "Novo acordo ou dissídio",
  OUTRO_CUSTO: "Outro custo",
} as const;

/** Documentos que o órgão costuma pedir (Fluxo 3, passo 4). */
export const CHECKLIST = [
  { id: "planilha_atual", nome: "Planilha de custos da proposta ou do último apostilamento", obrigatorio: true },
  { id: "planilha_nova", nome: "Planilha de custos nova (gerada pela Equapar)", obrigatorio: true, automatico: true },
  { id: "memoria", nome: "Memória de cálculo com a demonstração analítica (gerada pela Equapar)", obrigatorio: true, automatico: true },
  { id: "convencao_nova", nome: "Convenção coletiva nova, com o registro no sistema Mediador", obrigatorio: true },
  { id: "convencao_anterior", nome: "Convenção coletiva usada na proposta", obrigatorio: false },
  { id: "folha", nome: "Folha de pagamento ou contracheques que mostrem o novo piso", obrigatorio: false },
  { id: "contrato", nome: "Cópia do contrato e dos termos aditivos", obrigatorio: false },
] as const;

export type SituacaoDoc = "ANEXADO" | "FALTA" | "OPCIONAL";

export function situacaoChecklist(p: Pick<Pedido, "checklist" | "planilhaAgora" | "dataDeposito">, anexos: { tipo: string }[]) {
  const marcado = (p.checklist as Record<string, SituacaoDoc> | null) ?? {};
  const tem = (tipo: string) => anexos.some((a) => a.tipo === tipo);
  return CHECKLIST.map((item) => {
    let s: SituacaoDoc;
    if ("automatico" in item && item.automatico) s = p.planilhaAgora ? "ANEXADO" : "FALTA";
    else if (item.id === "planilha_atual" && tem("PLANILHA")) s = "ANEXADO";
    else if (item.id === "convencao_nova" && tem("CONVENCAO")) s = "ANEXADO";
    else if (marcado[item.id] === "ANEXADO") s = "ANEXADO";
    else s = item.obrigatorio ? "FALTA" : "OPCIONAL";
    return { ...item, situacao: s };
  });
}

export interface CalculoPedido {
  comparacao: Comparacao | null;
  retroativo: Retroativo | null;
  dataReferencia: Date;
  versaoRegra: string;
  pronto: boolean;
}

export function calcularPedido(p: Pick<Pedido, "planilhaAntes" | "planilhaAgora" | "dataBase" | "dataReferencia">): CalculoPedido {
  const dataReferencia = p.dataReferencia ?? hojeUTC();
  if (!p.planilhaAntes || !p.planilhaAgora) return { comparacao: null, retroativo: null, dataReferencia, versaoRegra: VERSAO_REGRA, pronto: false };
  const comparacao = compararPlanilhas(p.planilhaAntes as unknown as PlanilhaCustos, p.planilhaAgora as unknown as PlanilhaCustos);
  const retroativo = comparacao.erros.length === 0 && p.dataBase ? calcularRetroativo(comparacao.diferencaMensal, p.dataBase, dataReferencia) : null;
  return { comparacao, retroativo, dataReferencia, versaoRegra: VERSAO_REGRA, pronto: comparacao.erros.length === 0 };
}

/** Os 6 estados do dinheiro, em ordem (Dossiê, "Como funciona" item 6). */
export const ESTADOS = [
  { id: "EM_ANALISE", nome: "Oportunidade em análise" },
  { id: "CALCULO_VALIDADO", nome: "Cálculo validado" },
  { id: "PROTOCOLADO", nome: "Pedido protocolado" },
  { id: "DEFERIDO", nome: "Valor deferido" },
  { id: "FATURADO", nome: "Diferença faturada" },
  { id: "RECEBIDO", nome: "Dinheiro recebido" },
] as const;

export const NOME_ESTADO: Record<string, string> = {
  ...Object.fromEntries(ESTADOS.map((e) => [e.id, e.nome])),
  INDEFERIDO: "Indeferido",
};
