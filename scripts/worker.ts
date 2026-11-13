/**
 * Fase 1 (4.1.1). Processo da fila: `npm run worker` (um ou mais, em paralelo, sem pegar a mesma tarefa).
 * Agenda os avisos de hora em hora e executa as tarefas vencidas. Sai com SIGTERM/SIGINT depois da tarefa atual.
 */
import os from "node:os";
import { pegarProxima } from "../src/lib/fila";
import { agendarAvisosDaHora, executarTarefa } from "../src/lib/tarefas";
import { registrar } from "../src/lib/registro";
import { db } from "../src/lib/db";
import { limparDemos, limpezaDemosLigada } from "../src/lib/limpeza-demos";

const id = `${os.hostname()}-${process.pid}`;
let parar = false;
for (const s of ["SIGTERM", "SIGINT"] as const) process.on(s, () => (parar = true));

async function main() {
  registrar("info", "worker_iniciou", { worker: id });
  let ultimaAgenda = 0;
  let ultimaLimpeza = 0;
  while (!parar) {
    if (Date.now() - ultimaAgenda > 60_000) {
      await agendarAvisosDaHora().catch((e) => registrar("erro", "agenda_avisos_falhou", { erro: String(e) }));
      ultimaAgenda = Date.now();
    }
    // A3: limpeza das demonstrações de hora em hora, só com LIMPEZA_DEMOS_AUTOMATICA=true (padrão desligado)
    if (limpezaDemosLigada() && Date.now() - ultimaLimpeza > 3_600_000) {
      ultimaLimpeza = Date.now();
      await limparDemos({ aplicar: true })
        .then((r) => registrar("info", "limpeza_demos", { contas: r.contas, contratos: r.contratos }))
        .catch((e) => registrar("erro", "limpeza_demos_falhou", { erro: String(e) }));
    }
    const t = await pegarProxima(id).catch((e) => (registrar("erro", "fila_indisponivel", { erro: String(e) }), null));
    if (t) await executarTarefa(t);
    else await new Promise((r) => setTimeout(r, 2000));
  }
  registrar("info", "worker_parou", { worker: id });
  await db.$disconnect();
}

main();
