import { describe, expect, it, vi } from "vitest";

// L3: os primeiros passos só alteram os contratos que a tela mostrou (não os arquivados nem os de fora).
const contratos = [
  { id: "A", arquivado: false, maoDeObraDedicada: true },
  { id: "B", arquivado: true, maoDeObraDedicada: true },
];
class Redirect extends Error {}
vi.mock("next/navigation", () => ({ redirect: () => { throw new Redirect(); }, unstable_rethrow: (e: unknown) => { if (e instanceof Redirect) throw e; } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", () => ({ exigir: async () => ({ conta: { id: "c1" } }), contexto: vi.fn(), contratoDaConta: vi.fn(), exigirUsuario: vi.fn(), registrarHistorico: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    contrato: {
      findMany: vi.fn(async ({ where }) => contratos.filter((c) => (!where.id || where.id.in.includes(c.id)) && (where.arquivado === undefined || c.arquivado === where.arquivado))),
      update: vi.fn(async ({ where, data }) => Object.assign(contratos.find((c) => c.id === where.id)!, data)),
      updateMany: vi.fn(async ({ where, data }) => {
        for (const c of contratos) if (where.id.in.includes(c.id) && (where.arquivado === undefined || c.arquivado === where.arquivado)) Object.assign(c, data);
      }),
    },
  },
}));
const { onboardingMarcar } = await import("./acoes");

describe("L3: primeiros passos", () => {
  it("desmarcar na tela não mexe no contrato arquivado que a tela não mostrou", async () => {
    const fd = new FormData();
    fd.append("exibido", "A"); // a tela mostrou só o A, e a pessoa desmarcou
    await onboardingMarcar({}, fd).catch((e) => {
      if (!(e instanceof Redirect)) throw e;
    });
    expect(contratos.find((c) => c.id === "A")!.maoDeObraDedicada).toBe(false);
    expect(contratos.find((c) => c.id === "B")!.maoDeObraDedicada).toBe(true);
  });
});
