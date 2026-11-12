import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "./db";
import { LIMITE_ARQUIVO_DEMO } from "./demo";

const RAIZ = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"));

export function caminhoAbsoluto(relativo: string) {
  const abs = path.resolve(/*turbopackIgnore: true*/ RAIZ, relativo);
  if (!abs.startsWith(RAIZ)) throw new Error("Caminho inválido.");
  return abs;
}

export const TIPOS_ACEITOS: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "text/csv": ".csv",
};

export const TAMANHO_MAX = 15 * 1024 * 1024;

export async function salvarArquivo(contaId: string, arquivo: File) {
  if (arquivo.size > TAMANHO_MAX) throw new Error("O arquivo passa de 15 MB.");
  if (arquivo.size > LIMITE_ARQUIVO_DEMO && (await db.conta.findUnique({ where: { id: contaId }, select: { demo: true } }))?.demo)
    throw new Error("Na demonstração, os arquivos podem ter até 2 MB.");
  const ext = TIPOS_ACEITOS[arquivo.type] ?? path.extname(arquivo.name).toLowerCase();
  if (!Object.values(TIPOS_ACEITOS).includes(ext)) throw new Error("Formato não aceito. Envie PDF, Excel (.xlsx), Word, imagem ou CSV.");
  const rel = path.join(contaId, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  const abs = caminhoAbsoluto(rel);
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(abs), { recursive: true });
  const buf = Buffer.from(await arquivo.arrayBuffer());
  await fs.writeFile(/*turbopackIgnore: true*/ abs, buf);
  const nome = arquivo.name.replace(/[^\w.\- ()À-ÿ]+/g, "_").slice(0, 120);
  return { caminho: rel, nome, mime: arquivo.type || "application/octet-stream", tamanho: arquivo.size, buffer: buf };
}

export async function lerArquivo(relativo: string) {
  return fs.readFile(/*turbopackIgnore: true*/ caminhoAbsoluto(relativo));
}

export async function apagarArquivo(relativo: string) {
  await fs.rm(/*turbopackIgnore: true*/ caminhoAbsoluto(relativo), { force: true });
}

export async function apagarPastaConta(contaId: string) {
  await fs.rm(/*turbopackIgnore: true*/ caminhoAbsoluto(contaId), { recursive: true, force: true });
}
