import type { Pedido } from "@prisma/client";
import { calcularRetroativo, compararPlanilhas, VERSAO_REGRA, type Comparacao, type Retroativo } from "./calculo/motor";
import type { PlanilhaCustos } from "./calculo/tipos";
import { hojeUTC } from "./format";

export const PASSOS = ["Gatilho", "Planilha atual", "Novos custos", "Documentos", "Revisão"] as const;

export const NOME_GATILHO = {
  NOVA_CONVENCAO: "Nova convenção coletiva",
  ACORDO_DISSIDIO: "Novo acordo ou dissídio",
  OUTRO_CUSTO: "Outro custo",
  JORNADA_EC141: "Mudança de lei: jornada (EC 141/2026)",
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

export function situacaoChecklist(p: Pick<Pedido, "checklist" | "planilhaAgora" | "dataDeposito"> & { gatilho?: Pedido["gatilho"] }, anexos: { tipo: string }[]) {
  const marcado = (p.checklist as Record<string, SituacaoDoc> | null) ?? {};
  const tem = (tipo: string) => anexos.some((a) => a.tipo === tipo);
  return CHECKLIST.map((item) => {
    let s: SituacaoDoc;
    if ("automatico" in item && item.automatico) s = p.planilhaAgora ? "ANEXADO" : "FALTA";
    else if (item.id === "planilha_atual" && tem("PLANILHA")) s = "ANEXADO";
    else if (item.id === "convencao_nova" && tem("CONVENCAO")) s = "ANEXADO";
    else if (marcado[item.id] === "ANEXADO") s = "ANEXADO";
    // 5.1: no pedido da jornada (EC 141), a convenção não é o fundamento: fica opcional
    else s = item.obrigatorio && !(p.gatilho === "JORNADA_EC141" && item.id === "convencao_nova") ? "FALTA" : "OPCIONAL";
    return { ...item, situacao: s };
  });
}

/** L11: texto da regra do retroativo escolhida (aparece na memória e no ofício). */
export const NOME_CONTAR_ATE = { DATA_INFORMADA: "a data informada", DATA_PROTOCOLO: "a data do protocolo", DATA_APOSTILAMENTO: "a data do apostilamento" } as const;
export const NOME_MES_INCOMPLETO = { DIAS_CORRIDOS: "dias corridos do mês", MES_30_DIAS: "mês de 30 dias" } as const;

export interface CalculoPedido {
  comparacao: Comparacao | null;
  retroativo: Retroativo | null;
  dataReferencia: Date;
  /** L11: regra usada no retroativo */
  regraRetroativo: string;
  versaoRegra: string;
  pronto: boolean;
}

type PedidoCalculo = Pick<Pedido, "planilhaAntes" | "planilhaAgora" | "dataBase" | "dataReferencia"> &
  Partial<Pick<Pedido, "retroContarAte" | "retroMesIncompleto" | "protocoloData" | "apostiladoEm">>;

/**
 * L11: até quando contar. Padrão: a data informada no passo 3. Opções do pedido: a data do protocolo
 * ou a do apostilamento (enquanto a data escolhida não existe, vale a data informada).
 */
function fimDoRetroativo(p: PedidoCalculo): Date {
  const informada = p.dataReferencia ?? hojeUTC();
  if (p.retroContarAte === "DATA_PROTOCOLO") return p.protocoloData ?? informada;
  if (p.retroContarAte === "DATA_APOSTILAMENTO") return p.apostiladoEm ?? informada;
  return informada;
}

export function calcularPedido(p: PedidoCalculo): CalculoPedido {
  const dataReferencia = fimDoRetroativo(p);
  const mes = p.retroMesIncompleto ?? "DIAS_CORRIDOS";
  const regraRetroativo = `contado até ${NOME_CONTAR_ATE[p.retroContarAte ?? "DATA_INFORMADA"]}, mês incompleto por ${NOME_MES_INCOMPLETO[mes]}`;
  if (!p.planilhaAntes || !p.planilhaAgora) return { comparacao: null, retroativo: null, dataReferencia, regraRetroativo, versaoRegra: VERSAO_REGRA, pronto: false };
  const comparacao = compararPlanilhas(p.planilhaAntes as unknown as PlanilhaCustos, p.planilhaAgora as unknown as PlanilhaCustos);
  const retroativo = comparacao.erros.length === 0 && p.dataBase ? calcularRetroativo(comparacao.diferencaMensal, p.dataBase, dataReferencia, mes) : null;
  return { comparacao, retroativo, dataReferencia, regraRetroativo, versaoRegra: VERSAO_REGRA, pronto: comparacao.erros.length === 0 };
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
