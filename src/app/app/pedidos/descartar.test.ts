import { describe, expect, it, vi } from "vitest";

// L6: descartar o pedido apaga do banco primeiro e depois só os arquivos daquele pedido.
const ordem: string[] = [];
class Redirect extends Error {}
vi.mock("next/navigation", () => ({ redirect: () => { throw new Redirect(); }, unstable_rethrow: (e: unknown) => { if (e instanceof Redirect) throw e; } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/eventos", () => ({ registrarEvento: vi.fn() }));
vi.mock("@/lib/storage", () => ({ salvarArquivo: vi.fn(), apagarArquivo: vi.fn(async (c: string) => ordem.push(`arquivo:${c}`)) }));
vi.mock("@/lib/auth", () => ({
  exigir: async () => ({ conta: { id: "c1" }, usuario: { nome: "Dono" } }),
  pedidoDaConta: async () => ({ id: "p1", contratoId: "k1", estado: "EM_ANALISE", criadoEm: new Date(Date.UTC(2026, 9, 1)) }),
  contratoDaConta: vi.fn(),
  registrarHistorico: vi.fn(async (_c: unknown, acao: string) => ordem.push(`historico:${acao}`)),
}));
vi.mock("@/lib/db", () => ({
  db: {
    documento: { findMany: vi.fn(async () => [{ caminho: "c1/a.pdf" }, { caminho: "c1/b.xlsx" }]) },
    pedido: { delete: vi.fn(async () => ordem.push("banco:pedido")) },
  },
}));
const { descartarPedido } = await import("./acoes");

describe("L6: descartar pedido", () => {
  it("apaga do banco, depois os arquivos do pedido, e registra no histórico do contrato", async () => {
    const f = new FormData();
    f.set("pedidoId", "p1");
    await descartarPedido({}, f).catch((e) => {
      if (!(e instanceof Redirect)) throw e;
    });
    expect(ordem.indexOf("banco:pedido")).toBe(0);
    expect(ordem).toContain("arquivo:c1/a.pdf");
    expect(ordem).toContain("arquivo:c1/b.xlsx");
    expect(ordem.some((x) => x.startsWith("historico:Descartou"))).toBe(true);
  });
});
