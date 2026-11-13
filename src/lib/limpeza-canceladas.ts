/**
 * C8. Guarda depois do cancelamento. A conta cancelada (cobrança encerrada: somente leitura depois da
 * carência) pode exportar tudo por 30 dias. Depois disso, os DOCUMENTOS OPERACIONAIS (arquivos enviados:
 * planilhas, convenções, folhas) são apagados por rotina, só com LIMPEZA_CONTAS_CANCELADAS=true (padrão
 * desligado, trava 2). Por padrão SIMULA.
 *
 * Ficam fora da limpeza (dados que a lei manda guardar, separados): faturas e notas (cobrança), histórico de
 * ações, sessões e avisos enviados (registros de acesso e de comunicação), a própria conta e seus usuários.
 */
import { db } from "./db";
import { armazenamento } from "./armazenamento";

export const DIAS_PARA_EXPORTAR = 30;
export const MANTIDOS_POR_LEI = ["Fatura (cobrança e nota fiscal)", "Historico (registro de ações)", "Sessao (registros de acesso)", "Aviso (comunicações enviadas)", "Conta, Membro e Usuario"];

export function limpezaCanceladasLigada() {
  return process.env.LIMPEZA_CONTAS_CANCELADAS === "true";
}

export async function limparContasCanceladas({ aplicar = false, agora = new Date() } = {}) {
  const corte = new Date(agora.getTime() - DIAS_PARA_EXPORTAR * 86_400_000);
  // somente leitura há mais de 30 dias: a carência terminou antes do corte
  const contas = await db.conta.findMany({ where: { demo: false, situacaoCobranca: { in: ["CARENCIA", "SOMENTE_LEITURA"] }, carenciaAte: { lt: corte } }, select: { id: true } });
  const ids = contas.map((c) => c.id);
  const docs = await db.documento.findMany({
    where: { OR: [{ contrato: { empresa: { contaId: { in: ids } } } }, { pedido: { contrato: { empresa: { contaId: { in: ids } } } } }, { convencao: { contaId: { in: ids } } }] },
    select: { id: true, caminho: true },
  });
  const resumo = {
    modo: aplicar ? "aplicar" : "simulacao",
    contas: ids.length,
    documentos: docs.length,
    mantidosPorLei: MANTIDOS_POR_LEI,
    faturasMantidas: await db.fatura.count({ where: { contaId: { in: ids } } }),
    contasAtivasNaLista: (await db.conta.count({ where: { id: { in: ids }, situacaoCobranca: { in: ["EM_DIA", "ATRASADA"] } } })),
  };
  if (!aplicar) return resumo;
  const arm = await armazenamento();
  for (const d of docs) {
    await db.documento.delete({ where: { id: d.id } }); // banco primeiro
    await arm.apagar(d.caminho).catch(() => {}); // arquivo depois
  }
  return resumo;
}
