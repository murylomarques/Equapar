/**
 * L17. Prorrogação do contrato. Se o termo aditivo é assinado sem pedido de repactuação protocolado
 * e sem ressalva, com uma convenção nova já depositada, há risco de preclusão do direito (TCU).
 */
type ContratoPrecl = { convencao: { dataDeposito: Date | null } | null; pedidos: { estado: string; protocoloData: Date | null }[] };

export function riscoPreclusao(pr: { dataTermo: Date; comRessalva: boolean }, c: ContratoPrecl): boolean {
  if (pr.comRessalva) return false;
  const dep = c.convencao?.dataDeposito;
  if (!dep || dep > pr.dataTermo) return false;
  const protegido = c.pedidos.some((p) => !!p.protocoloData && p.protocoloData >= dep && p.protocoloData <= pr.dataTermo);
  return !protegido;
}

// ---------------------------------------------------------------------------
// C5. Alerta de prorrogação ampliado, com grau. O caso "Confirmado" é exatamente o riscoPreclusao acima
// (os testes antigos continuam valendo); os outros dois casos são novos.
// ---------------------------------------------------------------------------

export type GrauAlerta = "Confirmado" | "Provável" | "A conferir";
export interface AlertaProrrogacao {
  grau: GrauAlerta;
  mensagem: string;
  porQue: string;
}

type ContratoAval = {
  vigenciaFim: Date;
  convencao: { dataDeposito: Date | null; mesDataBase: number | null } | null;
  pedidos: { estado: string; protocoloData: Date | null; gatilho?: string }[];
};

const DIA = 86_400_000;

/** Data-base mais recente até a data (o aniversário do mês da convenção). */
function dataBaseAte(mes: number, ate: Date) {
  const esteAno = new Date(Date.UTC(ate.getUTCFullYear(), mes - 1, 1));
  return esteAno <= ate ? esteAno : new Date(Date.UTC(ate.getUTCFullYear() - 1, mes - 1, 1));
}

/**
 * Avalia o risco antes de assinar (ou ao registrar) a prorrogação. `dataTermo` vazia = ainda não assinada.
 * Devolve null quando não há o que alertar.
 */
export function avaliarProrrogacao(pr: { dataTermo: Date | null; comRessalva: boolean; hoje: Date }, c: ContratoAval): AlertaProrrogacao | null {
  if (pr.comRessalva) return null;
  if (!c.convencao || !c.convencao.mesDataBase || (!pr.dataTermo && !c.vigenciaFim))
    return { grau: "A conferir", mensagem: "Faltam dados para avaliar o risco. Revise antes de assinar.", porQue: "Sem a convenção do contrato (e a data-base dela) ou sem a data do termo, não dá para saber se há repactuação a pedir." };
  const ref = pr.dataTermo ?? pr.hoje;
  if (pr.dataTermo && riscoPreclusao({ dataTermo: pr.dataTermo, comRessalva: false }, c))
    return { grau: "Confirmado", mensagem: "Revise antes de assinar: há repactuação a pedir.", porQue: "Há convenção nova depositada antes do termo, sem pedido de repactuação protocolado e sem ressalva. Para o TCU, prorrogar assim pode encerrar o direito." };
  const db = dataBaseAte(c.convencao.mesDataBase, ref);
  const depositada = !!c.convencao.dataDeposito && c.convencao.dataDeposito >= db;
  const protocolado = c.pedidos.some((p) => p.gatilho !== "JORNADA_EC141" && !!p.protocoloData && p.protocoloData >= db);
  const diasAteFim = Math.round((c.vigenciaFim.getTime() - pr.hoje.getTime()) / DIA);
  if (!depositada && !protocolado && diasAteFim <= 60)
    return { grau: "Provável", mensagem: "Registre a solicitação e avalie a ressalva antes de assinar.", porQue: "A data-base da convenção já passou e a convenção nova ainda não foi depositada, com a prorrogação a 60 dias ou menos. Registrar a solicitação e pedir a ressalva preserva o pedido." };
  if (!pr.dataTermo && depositada && !protocolado)
    return { grau: "Confirmado", mensagem: "Revise antes de assinar: há repactuação a pedir.", porQue: "A convenção nova já foi depositada e não há pedido de repactuação protocolado. Para o TCU, prorrogar assim pode encerrar o direito." };
  return null;
}

/**
 * D6. Jornada: a etapa já começou, o contrato tem mão de obra dedicada e a prorrogação vai ser (ou foi)
 * assinada sem pedido de reequilíbrio da jornada. Mesmo componente da C5, grau "Provável".
 * Só aparece para quem pode ver a jornada (chave mestra ou PAINEL_EMAILS).
 */
export function alertaJornadaNaProrrogacao(
  c: { maoDeObraDedicada: boolean; pedidos: { gatilho?: string; estado: string }[] },
  inicioEtapa: Date,
  hoje: Date,
): AlertaProrrogacao | null {
  if (!c.maoDeObraDedicada || hoje < inicioEtapa) return null;
  if (c.pedidos.some((p) => p.gatilho === "JORNADA_EC141" && p.estado !== "INDEFERIDO")) return null;
  return {
    grau: "Provável",
    mensagem: "Revise antes de assinar: a jornada mudou e não há pedido de reequilíbrio.",
    porQue: "A redução da jornada da EC 141/2026 já começou e este contrato tem mão de obra dedicada, mas não há pedido de reequilíbrio da jornada. Prorrogar sem pedir pode dificultar a recomposição do preço.",
  };
}
