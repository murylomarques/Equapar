import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { atrasoDaFila, concluir, enfileirar, falhar, pegarProxima } from "./fila";

// Teste de integração: precisa do PostgreSQL (npm run test:db). Usa só tarefas com prefixo de teste.
const PREFIXO = "teste-fila-";
async function limpar() {
  await db.tarefaFila.deleteMany({ where: { chave: { startsWith: PREFIXO } } });
}

describe("4.1.1: fila no PostgreSQL", () => {
  beforeEach(limpar);
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  it("a mesma chave não entra duas vezes", async () => {
    const a = await enfileirar("AVISOS", null, { chave: `${PREFIXO}1` });
    const b = await enfileirar("AVISOS", null, { chave: `${PREFIXO}1` });
    expect(b!.id).toBe(a!.id);
  });

  it("dois workers ao mesmo tempo nunca pegam a mesma tarefa", async () => {
    const passado = new Date(Date.now() - 1000);
    for (let i = 0; i < 6; i++) await enfileirar("AVISOS", { i }, { chave: `${PREFIXO}c${i}`, quando: passado });
    const pegas = await Promise.all(Array.from({ length: 6 }, (_, i) => pegarProxima(`w${i}`)));
    const minhas = pegas.filter((t) => t && (t.dados as { i?: number })?.i !== undefined);
    expect(new Set(minhas.map((t) => t!.id)).size).toBe(minhas.length);
    for (const t of minhas) await concluir(t!.id);
  });

  it("falha volta para a fila com espera; esgotadas as tentativas, fica FALHOU", async () => {
    const t0 = await enfileirar("PNCP_RETENTAR", null, { chave: `${PREFIXO}f`, quando: new Date(Date.now() - 1000), maxTentativas: 2 });
    let t = await pegarProxima("w");
    while (t && t.id !== t0!.id) t = await pegarProxima("w");
    await falhar(t!, "PNCP fora", { fixoMs: 0 });
    let r = await db.tarefaFila.findUnique({ where: { id: t0!.id } });
    expect(r!.status).toBe("PENDENTE");
    t = await pegarProxima("w", new Date(Date.now() + 1000));
    while (t && t.id !== t0!.id) t = await pegarProxima("w", new Date(Date.now() + 1000));
    await falhar(t!, "PNCP fora de novo");
    r = await db.tarefaFila.findUnique({ where: { id: t0!.id } });
    expect(r).toMatchObject({ status: "FALHOU", tentativas: 2 });
  });

  it("mede o atraso da fila", async () => {
    await enfileirar("AVISOS", null, { chave: `${PREFIXO}a`, quando: new Date(Date.now() - 20 * 60_000) });
    expect(await atrasoDaFila()).toBeGreaterThanOrEqual(20);
  });
});
