/** Roda a verificação de avisos uma vez: npm run avisos */
import { rodarAvisos } from "../src/lib/avisos";
import { db } from "../src/lib/db";

rodarAvisos()
  .then((r) => console.log("Avisos verificados:", r))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
