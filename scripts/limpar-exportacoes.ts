/**
 * L15. Exportações vencidas (mais de 7 dias): o download já é recusado; este script apaga os arquivos.
 * Por padrão só SIMULA: conta quantos arquivos e MB seriam apagados.
 *
 *   npx tsx --env-file=.env scripts/limpar-exportacoes.ts            # simulação
 *   npx tsx --env-file=.env scripts/limpar-exportacoes.ts --aplicar  # apaga (só com o "ok" do dono)
 *
 * O registro da exportação fica (com caminho vazio) para o histórico de quem pediu e quando.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const aplicar = process.argv.includes("--aplicar");
const RAIZ = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"));

async function main() {
  const limite = new Date(Date.now() - 7 * 86_400_000);
  const vencidas = await db.trabalhoFundo.findMany({
    where: { tipo: "EXPORTAR", caminho: { not: null }, OR: [{ concluidoEm: { lt: limite } }, { concluidoEm: null, criadoEm: { lt: limite } }] },
    select: { id: true, caminho: true },
  });
  let bytes = 0;
  for (const t of vencidas) bytes += (await fs.stat(path.resolve(RAIZ, t.caminho!)).catch(() => ({ size: 0 }))).size;
  console.log(aplicar ? "MODO APLICAR: apagando." : "SIMULAÇÃO: nada será apagado.");
  console.log(`Exportações vencidas com arquivo: ${vencidas.length} · ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  if (!aplicar) return;
  for (const t of vencidas) {
    await fs.rm(path.resolve(RAIZ, t.caminho!), { force: true });
    await db.trabalhoFundo.update({ where: { id: t.id }, data: { caminho: null } });
  }
  console.log(`Apagadas: ${vencidas.length}.`);
}

main().finally(() => db.$disconnect());
