/**
 * L6. Arquivos órfãos: arquivos no armazenamento que nenhum registro do banco usa
 * (Documento.caminho, Conta.marcaLogo, TrabalhoFundo.caminho), e pastas de contas que não existem mais.
 * Por padrão só SIMULA: conta quantos arquivos e quantos MB seriam apagados.
 *
 *   npx tsx --env-file=.env scripts/limpar-orfaos.ts            # simulação
 *   npx tsx --env-file=.env scripts/limpar-orfaos.ts --aplicar  # apaga (só com o "ok" do dono)
 *
 * Arquivos com menos de 24 horas ficam de fora (podem estar no meio de um envio).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const aplicar = process.argv.includes("--aplicar");
const RAIZ = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"));

async function listar(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listar(p)));
    else out.push(p);
  }
  return out;
}

async function main() {
  const usados = new Set<string>();
  for (const d of await db.documento.findMany({ select: { caminho: true } })) usados.add(path.resolve(RAIZ, d.caminho));
  for (const c of await db.conta.findMany({ where: { marcaLogo: { not: null } }, select: { marcaLogo: true } })) usados.add(path.resolve(RAIZ, c.marcaLogo!));
  for (const t of await db.trabalhoFundo.findMany({ where: { caminho: { not: null } }, select: { caminho: true } })) usados.add(path.resolve(RAIZ, t.caminho!));
  const limite = Date.now() - 24 * 3_600_000;
  let n = 0;
  let bytes = 0;
  const orfaos: string[] = [];
  for (const f of await listar(RAIZ)) {
    if (usados.has(path.resolve(f))) continue;
    const st = await fs.stat(f);
    if (st.mtimeMs > limite) continue;
    orfaos.push(f);
    n++;
    bytes += st.size;
  }
  console.log(aplicar ? "MODO APLICAR: apagando." : "SIMULAÇÃO: nada será apagado.");
  console.log(`Arquivos órfãos com mais de 24 horas: ${n} · ${(bytes / 1024 / 1024).toFixed(1)} MB (pasta ${RAIZ})`);
  if (!aplicar) return;
  for (const f of orfaos) await fs.rm(f, { force: true });
  console.log(`Apagados: ${n}.`);
}

main().finally(() => db.$disconnect());
