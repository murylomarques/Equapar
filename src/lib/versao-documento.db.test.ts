import { afterAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { proximaVersao } from "./versao-documento";

// 5.5: documentos com versão (precisa do PostgreSQL: npm run test:db). Cria e apaga só os próprios registros.
const criados: string[] = [];
afterAll(async () => {
  await db.documento.deleteMany({ where: { id: { in: criados } } });
  await db.$disconnect();
});

describe("5.5: versão dos documentos", () => {
  it("o mesmo tipo no mesmo pedido ganha a versão seguinte e a anterior continua guardada", async () => {
    const p = await db.pedido.findFirst({ where: { contrato: { empresa: { exemplo: true, conta: { demo: false, tipo: "EMPRESA" } } } }, select: { id: true, contratoId: true } });
    if (!p) throw new Error("Rode o seed.");
    const tipo = `TESTE_VERSAO_${Date.now()}`;
    const base = { pedidoId: p.id, contratoId: p.contratoId, tipo, nome: "x.pdf", mime: "application/pdf", tamanho: 1, caminho: "teste/x.pdf" };
    expect(await proximaVersao({ pedidoId: p.id }, tipo)).toBe(1);
    criados.push((await db.documento.create({ data: { ...base, versao: 1 } })).id);
    expect(await proximaVersao({ pedidoId: p.id }, tipo)).toBe(2);
    criados.push((await db.documento.create({ data: { ...base, versao: 2 } })).id);
    expect(await db.documento.count({ where: { pedidoId: p.id, tipo } })).toBe(2);
    expect(await proximaVersao({ contratoId: p.contratoId }, tipo)).toBe(1); // fora de pedido, conta à parte
  });
});
