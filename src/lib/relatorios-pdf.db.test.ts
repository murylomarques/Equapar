import { afterAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { relatorioAnoPdf, resumoSocioPdf } from "./relatorios-pdf";
import type { Contexto } from "./auth";

// Resumo para o sócio e relatório do ano (precisa do PostgreSQL com o seed: npm run test:db). Só lê.
afterAll(async () => {
  await db.$disconnect();
});

async function contextoDeExemplo() {
  const empresa = await db.empresa.findFirst({ where: { exemplo: true, conta: { demo: false, tipo: "EMPRESA" } }, include: { conta: true } });
  if (!empresa) throw new Error("Rode o seed: falta uma empresa de exemplo.");
  return { conta: empresa.conta, empresaId: null, empresaSelecionada: empresa, empresas: [empresa] } as unknown as Contexto;
}

describe("relatórios em PDF", () => {
  it("resumo para o sócio sai em PDF", async () => {
    const pdf = await resumoSocioPdf(await contextoDeExemplo());
    expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe("%PDF");
  }, 15_000);
  it("relatório do ano sai em PDF, também num ano sem movimento", async () => {
    const ctx = await contextoDeExemplo();
    for (const ano of [new Date().getUTCFullYear(), 2001]) {
      const pdf = await relatorioAnoPdf(ctx, ano);
      expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe("%PDF");
    }
  }, 15_000);
});
