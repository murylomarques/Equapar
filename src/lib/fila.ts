/**
 * Fase 1 (4.1.1). Fila de tarefas no próprio PostgreSQL (tabela TarefaFila), sem serviço novo.
 * - enfileirar(): cria a tarefa; com `chave`, a mesma tarefa não entra duas vezes.
 * - pegarProxima(): um worker trava a próxima tarefa vencida com FOR UPDATE SKIP LOCKED
 *   (dois workers nunca pegam a mesma). A trava vence sozinha se o worker morrer.
 * - concluir()/falhar(): falha volta para a fila com espera crescente, até o máximo de tentativas.
 * O processo que roda as tarefas é o `npm run worker` (scripts/worker.ts).
 */
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export type TipoTarefa = "AVISOS" | "PNCP_RETENTAR" | "EXPORTAR";

export type Tarefa = { id: string; tipo: TipoTarefa; dados: Prisma.JsonValue; tentativas: number; maxTentativas: number };

const TRAVA_MS = 10 * 60_000;

export async function enfileirar(tipo: TipoTarefa, dados: Prisma.InputJsonValue | null, opts: { chave?: string; quando?: Date; maxTentativas?: number } = {}) {
  if (opts.chave) {
    const ja = await db.tarefaFila.findUnique({ where: { chave: opts.chave } });
    if (ja) return ja;
  }
  try {
    return await db.tarefaFila.create({
      data: { tipo, dados: dados ?? undefined, chave: opts.chave, proximaEm: opts.quando ?? new Date(), maxTentativas: opts.maxTentativas ?? 5 },
    });
  } catch (e) {
    // corrida: outra instância criou a mesma chave ao mesmo tempo
    if (opts.chave && (e as { code?: string }).code === "P2002") return db.tarefaFila.findUnique({ where: { chave: opts.chave } });
    throw e;
  }
}

/** Trava e devolve a próxima tarefa vencida (pendente, ou rodando com a trava vencida). */
export async function pegarProxima(worker: string, agora = new Date()): Promise<Tarefa | null> {
  const travaAte = new Date(agora.getTime() + TRAVA_MS);
  const linhas = await db.$queryRaw<Tarefa[]>`
    UPDATE "TarefaFila" SET status = 'RODANDO', "travadaAte" = ${travaAte}, "travadaPor" = ${worker}, tentativas = tentativas + 1
    WHERE id = (
      SELECT id FROM "TarefaFila"
      WHERE (status = 'PENDENTE' AND "proximaEm" <= ${agora}) OR (status = 'RODANDO' AND "travadaAte" < ${agora})
      ORDER BY "proximaEm" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, tipo, dados, tentativas, "maxTentativas"`;
  return linhas[0] ?? null;
}

export async function concluir(id: string) {
  await db.tarefaFila.update({ where: { id }, data: { status: "FEITA", concluidaEm: new Date(), travadaAte: null, erro: null } });
}

/** Espera antes da próxima tentativa: 1, 2, 4, 8… minutos, no máximo 1 hora (ou um intervalo fixo). */
export function esperaMs(tentativas: number, fixoMs?: number) {
  return fixoMs ?? Math.min(60, 2 ** Math.max(0, tentativas - 1)) * 60_000;
}

export async function falhar(t: Pick<Tarefa, "id" | "tentativas" | "maxTentativas">, erro: string, opts: { fixoMs?: number } = {}) {
  const fim = t.tentativas >= t.maxTentativas;
  await db.tarefaFila.update({
    where: { id: t.id },
    data: fim
      ? { status: "FALHOU", erro: erro.slice(0, 500), travadaAte: null, concluidaEm: new Date() }
      : { status: "PENDENTE", erro: erro.slice(0, 500), travadaAte: null, proximaEm: new Date(Date.now() + esperaMs(t.tentativas, opts.fixoMs)) },
  });
}

/** Saúde da fila: a tarefa pendente mais atrasada, em minutos (null se não há atraso). */
export async function atrasoDaFila(agora = new Date()): Promise<number | null> {
  const t = await db.tarefaFila.findFirst({ where: { status: "PENDENTE", proximaEm: { lt: agora } }, orderBy: { proximaEm: "asc" }, select: { proximaEm: true } });
  return t ? Math.round((agora.getTime() - t.proximaEm.getTime()) / 60_000) : null;
}
