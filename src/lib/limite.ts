/**
 * S1. Limite de tentativas de acesso no banco (vale com vários processos e sobrevive a reinícios).
 * Chaves separadas por e-mail e por IP. O IP só conta quando vem do cabeçalho de um proxy de
 * confiança (TRUSTED_PROXY_HEADER, ex.: "cf-connecting-ip" ou "x-real-ip"): sem isso, qualquer
 * navegador poderia inventar um X-Forwarded-For novo a cada tentativa.
 */
import { db } from "./db";

const JANELA_MS = 15 * 60_000;
const BLOQUEIO_MS = 15 * 60_000;
const LIMITE_EMAIL = 5;
const LIMITE_IP = 30;

type Estado = { falhas: number; janelaAte: Date; bloqueadoAte: Date | null };

/** Regra pura: soma uma falha dentro da janela; ao atingir o limite, bloqueia por 15 minutos. */
export function proximaTentativa(atual: Estado | null, agora: Date, limite: number): Estado {
  const dentro = atual && atual.janelaAte > agora;
  const falhas = dentro ? atual.falhas + 1 : 1;
  const janelaAte = dentro ? atual.janelaAte : new Date(agora.getTime() + JANELA_MS);
  const bloqueadoAte = falhas >= limite ? new Date(agora.getTime() + BLOQUEIO_MS) : dentro ? atual.bloqueadoAte : null;
  return { falhas, janelaAte, bloqueadoAte };
}

/** IP do cliente informado pelo proxy de confiança, ou null. */
export function ipConfiavel(h: Headers): string | null {
  const nome = process.env.TRUSTED_PROXY_HEADER?.trim().toLowerCase();
  if (!nome) return null;
  const v = h.get(nome);
  if (!v) return null;
  // Em X-Forwarded-For, o proxy de confiança acrescenta o IP de quem falou com ele: o último da lista.
  const ip = nome === "x-forwarded-for" ? v.split(",").at(-1) : v.split(",")[0];
  return ip?.trim() || null;
}

export function chavesDeAcesso(email: string, h: Headers): string[] {
  const ip = ipConfiavel(h);
  return [`email:${email.trim().toLowerCase()}`, ...(ip ? [`ip:${ip}`] : [])];
}

export async function estaBloqueado(chaves: string[], agora = new Date()): Promise<boolean> {
  const ts = await db.tentativaAcesso.findMany({ where: { chave: { in: chaves } } });
  return ts.some((t) => !!t.bloqueadoAte && t.bloqueadoAte > agora);
}

export async function registrarFalha(chaves: string[], agora = new Date()) {
  for (const chave of chaves) {
    const atual = await db.tentativaAcesso.findUnique({ where: { chave } });
    const prox = proximaTentativa(atual, agora, chave.startsWith("ip:") ? LIMITE_IP : LIMITE_EMAIL);
    await db.tentativaAcesso.upsert({ where: { chave }, create: { chave, ...prox }, update: prox });
  }
}

/** Depois de um acesso certo, zera o contador do e-mail (o do IP continua, para frear ataques em massa). */
export async function limparTentativas(email: string) {
  await limparChave(`email:${email.trim().toLowerCase()}`);
}

export async function limparChave(chave: string) {
  await db.tentativaAcesso.deleteMany({ where: { chave } });
}
