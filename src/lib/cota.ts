/**
 * S2. Cotas por dia dos formulários e rotas públicas (Raio-X, relatório, "avisar depois").
 * Usa a mesma tabela das tentativas de acesso: `falhas` conta os usos e `janelaAte` é o fim do dia
 * (horário de Brasília). Se qualquer cota estoura, nada é gasto e o pedido é recusado.
 */
import { db } from "./db";

export type Cota = { chave: string; limite: number };

function fimDoDiaBrasilia(agora: Date): Date {
  const br = new Date(agora.getTime() - 3 * 3_600_000); // UTC-3
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() + 1) + 3 * 3_600_000);
}

/** Consome uma unidade de cada cota; devolve false (sem gastar nada) se alguma já chegou ao limite. */
export async function consumirCotas(cotas: Cota[], agora = new Date()): Promise<boolean> {
  const atuais = await Promise.all(cotas.map((c) => db.tentativaAcesso.findUnique({ where: { chave: `cota:${c.chave}` } })));
  const usos = atuais.map((t) => (t && t.janelaAte > agora ? t.falhas : 0));
  if (cotas.some((c, i) => usos[i] >= c.limite)) return false;
  const janelaAte = fimDoDiaBrasilia(agora);
  for (const [i, c] of cotas.entries()) {
    const dados = { falhas: usos[i] + 1, janelaAte, bloqueadoAte: null };
    await db.tentativaAcesso.upsert({ where: { chave: `cota:${c.chave}` }, create: { chave: `cota:${c.chave}`, ...dados }, update: dados });
  }
  return true;
}
