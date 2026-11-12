import { beforeEach, describe, expect, it, vi } from "vitest";

// L5: o passo 1 não pode mudar a convenção compartilhada sem perguntar.
const conv = { id: "cv", contaId: "c1", dataDeposito: new Date(Date.UTC(2026, 1, 10)) as Date | null, situacao: "REGISTRADA" };
const atualizacoesConv: Record<string, unknown>[] = [];
class Redirect extends Error {}
vi.mock("next/navigation", () => ({ redirect: () => { throw new Redirect(); }, unstable_rethrow: (e: unknown) => { if (e instanceof Redirect) throw e; } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/eventos", () => ({ registrarEvento: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  exigir: async () => ({ conta: { id: "c1" }, usuario: { nome: "Dono" } }),
  pedidoDaConta: async () => ({ id: "p1", contratoId: "k1", estado: "EM_ANALISE", passoAtual: 1, gatilho: "NOVA_CONVENCAO", convencaoId: "cv", dataBase: new Date(Date.UTC(2026, 0, 1)), dataReferencia: null, memoriaAprovadaEm: null, planilhaAntes: null, planilhaAgora: null }),
  contratoDaConta: vi.fn(),
  registrarHistorico: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    convencao: {
      findFirst: vi.fn(async () => ({ ...conv })),
      update: vi.fn(async ({ data }) => atualizacoesConv.push(data)),
    },
    contrato: { count: vi.fn(async () => 4) },
    pedido: { update: vi.fn(async () => ({})) },
  },
}));
const { salvarPasso1 } = await import("./acoes");
const enviar = async (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ pedidoId: "p1", gatilho: "NOVA_CONVENCAO", convencaoId: "cv", dataBase: "2026-01-01", ...o })) f.set(k, v);
  return salvarPasso1({}, f).catch((e) => {
    if (!(e instanceof Redirect)) throw e;
    return {};
  });
};

describe("L5: passo 1 e a convenção compartilhada", () => {
  beforeEach(() => {
    atualizacoesConv.length = 0;
    conv.dataDeposito = new Date(Date.UTC(2026, 1, 10));
  });
  it("data de depósito diferente, sem confirmação: a convenção não muda", async () => {
    await enviar({ dataDeposito: "2026-03-01" });
    expect(atualizacoesConv).toEqual([]);
  });
  it("com a confirmação, atualiza a convenção", async () => {
    await enviar({ dataDeposito: "2026-03-01", atualizarConvencao: "on" });
    expect(atualizacoesConv).toHaveLength(1);
  });
  it("convenção sem data de depósito: preenche sem perguntar", async () => {
    conv.dataDeposito = null;
    await enviar({ dataDeposito: "2026-03-01" });
    expect(atualizacoesConv).toHaveLength(1);
  });
});
