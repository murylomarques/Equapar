/**
 * Fase 1 (4.1.1). O que cada tipo de tarefa da fila faz. Roda no worker (scripts/worker.ts).
 */
import { concluir, enfileirar, falhar, type Tarefa } from "./fila";
import { registrar } from "./registro";

const MEIA_HORA = 30 * 60_000;

/** Agenda os avisos da hora (uma tarefa por hora, pela chave). */
export async function agendarAvisosDaHora(agora = new Date()) {
  const hora = agora.toISOString().slice(0, 13);
  await enfileirar("AVISOS", null, { chave: `avisos:${hora}`, maxTentativas: 3 });
}

/** L13: o PNCP estava fora; tenta de novo a cada 30 minutos por 24 horas e manda o link quando der certo. */
export async function agendarRetentativaPncp(cnpj: string, email: string) {
  return enfileirar("PNCP_RETENTAR", { cnpj, email }, { chave: `pncp:${cnpj}:${email}:${new Date().toISOString().slice(0, 10)}`, quando: new Date(Date.now() + MEIA_HORA), maxTentativas: 48 });
}

export async function executarTarefa(t: Tarefa) {
  const inicio = Date.now();
  try {
    if (t.tipo === "AVISOS") {
      const { rodarAvisos } = await import("./avisos");
      const r = await rodarAvisos();
      registrar("info", "tarefa_avisos", { ...r });
    } else if (t.tipo === "PNCP_RETENTAR") {
      const { cnpj, email } = t.dados as { cnpj: string; email: string };
      const { consultarPncp } = await import("./pncp");
      await consultarPncp(cnpj, { semCache: true, timeoutMs: 30_000 });
      const { appUrl, enviar } = await import("./mensagens");
      const { formatarCnpj } = await import("./cnpj");
      await enviar({
        contaId: null,
        chave: `RAIOX-PRONTO:${cnpj}:${email}:${new Date().toISOString().slice(0, 10)}`,
        tipo: "RAIOX",
        canal: "EMAIL",
        destino: email,
        assunto: `A consulta ao PNCP terminou (CNPJ ${formatarCnpj(cnpj)})`,
        corpo: `A consulta terminou. Veja os contratos e prazos: ${appUrl(`/raio-x?cnpj=${cnpj}`)}`,
      });
    } else if (t.tipo === "EXPORTAR") {
      const { trabalhoId, contaId } = t.dados as { trabalhoId: string; contaId: string };
      const { executarExportacao } = await import("./exportacao");
      await executarExportacao(trabalhoId, contaId);
    }
    await concluir(t.id);
    registrar("info", "tarefa_feita", { tarefa: t.id, tipo: t.tipo, ms: Date.now() - inicio });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    await falhar(t, msg, t.tipo === "PNCP_RETENTAR" ? { fixoMs: MEIA_HORA } : {});
    registrar("aviso", "tarefa_falhou", { tarefa: t.id, tipo: t.tipo, tentativa: t.tentativas, erro: msg.slice(0, 200) });
  }
}
