/**
 * Fase 1 (4.1.1). Processo da fila: `npm run worker` (um ou mais, em paralelo, sem pegar a mesma tarefa).
 * Agenda os avisos de hora em hora e executa as tarefas vencidas. Sai com SIGTERM/SIGINT depois da tarefa atual.
 */
import os from "node:os";
import { pegarProxima } from "../src/lib/fila";
import { agendarAvisosDaHora, executarTarefa } from "../src/lib/tarefas";
import { registrar } from "../src/lib/registro";
import { db } from "../src/lib/db";

const id = `${os.hostname()}-${process.pid}`;
let parar = false;
for (const s of ["SIGTERM", "SIGINT"] as const) process.on(s, () => (parar = true));

async function main() {
  registrar("info", "worker_iniciou", { worker: id });
  let ultimaAgenda = 0;
  while (!parar) {
    if (Date.now() - ultimaAgenda > 60_000) {
      await agendarAvisosDaHora().catch((e) => registrar("erro", "agenda_avisos_falhou", { erro: String(e) }));
      ultimaAgenda = Date.now();
    }
    const t = await pegarProxima(id).catch((e) => (registrar("erro", "fila_indisponivel", { erro: String(e) }), null));
    if (t) await executarTarefa(t);
    else await new Promise((r) => setTimeout(r, 2000));
  }
  registrar("info", "worker_parou", { worker: id });
  await db.$disconnect();
}

main();
