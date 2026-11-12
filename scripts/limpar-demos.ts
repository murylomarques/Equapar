/**
 * C6.4. Limpa as contas de demonstração vencidas (cópias dos visitantes, 4 horas).
 * Por padrão só SIMULA: conta quantas contas, usuários e arquivos seriam apagados.
 *
 *   npx tsx --env-file=.env scripts/limpar-demos.ts            # simulação
 *   npx tsx --env-file=.env scripts/limpar-demos.ts --aplicar  # apaga (só com o "ok" do dono)
 *
 * Só toca em contas com demo = true e demoExpiraEm no passado. A conta modelo (fictícia do seed) nunca entra.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// Mesma regra de src/lib/storage.ts (que é só do servidor): STORAGE_DIR/<contaId>
const RAIZ = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"));
async function apagarPastaConta(contaId: string) {
  const abs = path.resolve(RAIZ, contaId);
  if (!abs.startsWith(RAIZ + path.sep)) throw new Error("Caminho inválido.");
  await fs.rm(abs, { recursive: true, force: true });
}

const db = new PrismaClient();
const aplicar = process.argv.includes("--aplicar");

async function main() {
  const vencidas = await db.conta.findMany({ where: { demo: true, demoExpiraEm: { lt: new Date() } }, select: { id: true } });
  const ids = vencidas.map((c) => c.id);
  const usuarios = (await db.membro.findMany({ where: { contaId: { in: ids } }, select: { usuarioId: true } })).map((m) => m.usuarioId);
  const arquivos = await db.documento.count({ where: { OR: [{ contrato: { empresa: { contaId: { in: ids } } } }, { convencao: { contaId: { in: ids } } }] } });
  console.log(aplicar ? "MODO APLICAR: apagando." : "SIMULAÇÃO: nada será apagado.");
  console.log(`Contas de demonstração vencidas: ${vencidas.length} · usuários visitantes: ${usuarios.length} · arquivos enviados: ${arquivos}`);
  if (!aplicar) return;
  for (const c of vencidas) {
    await db.conta.delete({ where: { id: c.id } }); // banco primeiro (cascata)
    await apagarPastaConta(c.id); // arquivos depois
  }
  await db.usuario.deleteMany({ where: { id: { in: usuarios }, email: { endsWith: "@demo.equapar.local" } } });
  console.log(`Apagado: ${vencidas.length} conta(s) e ${usuarios.length} visitante(s).`);
}

main().finally(() => db.$disconnect());
