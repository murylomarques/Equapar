import { beforeEach, describe, expect, it, vi } from "vitest";

// L14: trocar de conta só para contas em que a pessoa é membro.
const sessoes: { id: string; contaId: string; empresaId: string | null }[] = [{ id: "s1", contaId: "a", empresaId: "e1" }];
class Redirect extends Error {}
vi.mock("next/navigation", () => ({ redirect: () => { throw new Redirect(); }, unstable_rethrow: (e: unknown) => { if (e instanceof Redirect) throw e; } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", () => ({
  contexto: async () => ({ sessaoId: "s1", usuario: { id: "u1" }, conta: { id: "a" } }),
  exigir: vi.fn(), exigirUsuario: vi.fn(), contratoDaConta: vi.fn(), registrarHistorico: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    membro: { findUnique: vi.fn(async ({ where }) => (["a", "b"].includes(where.usuarioId_contaId.contaId) ? { contaId: where.usuarioId_contaId.contaId } : null)) },
    sessao: { update: vi.fn(async ({ where, data }) => Object.assign(sessoes.find((s) => s.id === where.id)!, data)) },
  },
}));
const { trocarConta } = await import("./acoes");
const chamar = async (contaId: string) => {
  const f = new FormData();
  f.set("contaId", contaId);
  try {
    return await trocarConta({}, f);
  } catch (e) {
    if (e instanceof Redirect) return { redirect: true };
    throw e;
  }
};

describe("L14: trocar de conta", () => {
  beforeEach(() => {
    Object.assign(sessoes[0], { contaId: "a", empresaId: "e1" });
    vi.stubEnv("MODO_PILOTO", "false"); // A6: a troca de conta só existe fora do piloto
  });
  it("A6: no modo piloto, a troca de conta é recusada e nada muda", async () => {
    vi.stubEnv("MODO_PILOTO", "true");
    expect(await chamar("b")).toHaveProperty("erro");
    expect(sessoes[0].contaId).toBe("a");
  });
  it("troca para outra conta da pessoa e limpa o cliente selecionado", async () => {
    expect(await chamar("b")).toEqual({ redirect: true });
    expect(sessoes[0]).toMatchObject({ contaId: "b", empresaId: null });
  });
  it("recusa conta de que a pessoa não participa", async () => {
    const r = await chamar("x");
    expect(r).toHaveProperty("erro");
    expect(sessoes[0].contaId).toBe("a");
  });
});
