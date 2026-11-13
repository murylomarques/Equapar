/**
 * C8. Simulação (padrão) ou aplicação da limpeza dos documentos de contas canceladas há mais de 30 dias.
 *   npx tsx --tsconfig tsconfig.worker.json --env-file=.env scripts/limpar-contas-canceladas.ts            # simulação
 *   npx tsx --tsconfig tsconfig.worker.json --env-file=.env scripts/limpar-contas-canceladas.ts --aplicar  # apaga (decisão do dono)
 */
import { limparContasCanceladas } from "../src/lib/limpeza-canceladas";
import { db } from "../src/lib/db";

const aplicar = process.argv.includes("--aplicar");
limparContasCanceladas({ aplicar })
  .then((r) => {
    console.log(aplicar ? "MODO APLICAR: apagado." : "SIMULAÇÃO: nada foi apagado.");
    console.log(JSON.stringify(r, null, 2));
  })
  .finally(() => db.$disconnect());
