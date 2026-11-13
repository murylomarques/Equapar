/**
 * C6.4 / A3. Limpa as contas de demonstração (cópias dos visitantes com mais de 4 horas).
 * Por padrão só SIMULA: conta o que seria apagado.
 *
 *   npx tsx --tsconfig tsconfig.worker.json --env-file=.env scripts/limpar-demos.ts            # simulação
 *   npx tsx --tsconfig tsconfig.worker.json --env-file=.env scripts/limpar-demos.ts --aplicar  # apaga (decisão do dono)
 *
 * A regra está em src/lib/limpeza-demos.ts (a mesma que o worker usa com LIMPEZA_DEMOS_AUTOMATICA=true).
 */
import { limparDemos } from "../src/lib/limpeza-demos";
import { db } from "../src/lib/db";

const aplicar = process.argv.includes("--aplicar");
limparDemos({ aplicar })
  .then((r) => {
    console.log(aplicar ? "MODO APLICAR: apagado." : "SIMULAÇÃO: nada foi apagado.");
    console.log(JSON.stringify(r, null, 2));
  })
  .finally(() => db.$disconnect());
