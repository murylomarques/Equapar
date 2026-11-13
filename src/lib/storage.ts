import "server-only";
import crypto from "node:crypto";
import { db } from "./db";
import { LIMITE_ARQUIVO_DEMO } from "./demo";
import { conferirTipo } from "./arquivo-tipo";
import { ErroUsuario } from "./acao";
import { armazenamento } from "./armazenamento";

/** Arquivos enviados: tudo passa pela interface Armazenamento (disco em desenvolvimento, S3 em produção). */

export const TAMANHO_MAX = 15 * 1024 * 1024;

export async function salvarArquivo(contaId: string, arquivo: File) {
  if (arquivo.size > TAMANHO_MAX) throw new ErroUsuario("O arquivo passa de 15 MB.");
  if (arquivo.size > LIMITE_ARQUIVO_DEMO && (await db.conta.findUnique({ where: { id: contaId }, select: { demo: true } }))?.demo)
    throw new ErroUsuario("Na demonstração, os arquivos podem ter até 2 MB.");
  const buf = Buffer.from(await arquivo.arrayBuffer());
  // S4: o conteúdo real precisa bater com a extensão; grava o tipo detectado, não o informado pelo navegador
  const tipo = conferirTipo(arquivo.name, buf);
  if (!tipo) throw new ErroUsuario("O conteúdo do arquivo não confere com o formato do nome. Envie PDF, Excel (.xlsx), Word (.docx), imagem (PNG ou JPG) ou CSV.");
  const rel = `${contaId}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}${tipo.ext}`;
  await (await armazenamento()).gravar(rel, buf, tipo.mime);
  const nome = arquivo.name.replace(/[^\w.\- ()À-ÿ]+/g, "_").slice(0, 120);
  return { caminho: rel, nome, mime: tipo.mime, tamanho: arquivo.size, buffer: buf };
}

export async function gravarArquivo(chave: string, dados: Buffer, mime: string) {
  await (await armazenamento()).gravar(chave, dados, mime);
}

export async function lerArquivo(relativo: string) {
  return (await armazenamento()).ler(relativo);
}

export async function apagarArquivo(relativo: string) {
  await (await armazenamento()).apagar(relativo);
}

export async function apagarPastaConta(contaId: string) {
  await (await armazenamento()).apagarPrefixo(contaId);
}

/** Link de download curto direto do bucket (S3); null no disco (o download passa pelo app). */
export async function linkTemporario(relativo: string, nomeArquivo: string, inline = false) {
  const a = await armazenamento();
  return a.linkTemporario ? a.linkTemporario(relativo, nomeArquivo, 300, inline) : null;
}
