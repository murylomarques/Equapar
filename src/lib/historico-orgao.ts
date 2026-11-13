/**
 * 5.4: histórico do órgão DENTRO da conta. O que a própria conta já viveu com o órgão (pelo CNPJ do órgão;
 * sem CNPJ, pelo nome exato). Nunca junta dados de outras contas.
 */
import "server-only";
import { db } from "./db";

type P = { estado: string; protocoloData: Date | null; respostaData: Date | null; deferidoEm: Date | null; apostiladoEm: Date | null };

const DIA = 86_400_000;
const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function resumoOrgao(pedidos: P[]) {
  const feitos = pedidos.filter((p) => p.protocoloData);
  return {
    feitos: feitos.length,
    deferidos: pedidos.filter((p) => p.deferidoEm || ["DEFERIDO", "FATURADO", "RECEBIDO"].includes(p.estado)).length,
    indeferidos: pedidos.filter((p) => p.estado === "INDEFERIDO").length,
    diasAteResposta: media(feitos.filter((p) => p.respostaData).map((p) => (p.respostaData!.getTime() - p.protocoloData!.getTime()) / DIA)),
    diasAteApostilamento: media(pedidos.filter((p) => p.deferidoEm && p.apostiladoEm).map((p) => (p.apostiladoEm!.getTime() - p.deferidoEm!.getTime()) / DIA)),
  };
}

export async function historicoDoOrgao(contaId: string, orgao: { orgaoCnpj: string | null; orgao: string }) {
  const pedidos = await db.pedido.findMany({
    where: { contrato: { empresa: { contaId }, ...(orgao.orgaoCnpj ? { orgaoCnpj: orgao.orgaoCnpj } : { orgao: orgao.orgao }) } },
    select: { estado: true, protocoloData: true, respostaData: true, deferidoEm: true, apostiladoEm: true },
  });
  return resumoOrgao(pedidos);
}
