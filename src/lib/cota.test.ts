import { beforeEach, describe, expect, it, vi } from "vitest";

const tabela = new Map<string, { chave: string; falhas: number; janelaAte: Date; bloqueadoAte: Date | null }>();
vi.mock("./db", () => ({
  db: {
    tentativaAcesso: {
      findUnique: vi.fn(async ({ where }) => tabela.get(where.chave) ?? null),
      upsert: vi.fn(async ({ where, create, update }) => {
        const t = tabela.get(where.chave);
        tabela.set(where.chave, t ? { ...t, ...update } : { ...create });
      }),
    },
  },
}));
const { consumirCotas } = await import("./cota");

describe("S2: cota diária dos formulários públicos", () => {
  beforeEach(() => tabela.clear());
  it("o mesmo e-mail recebe no máximo 3 relatórios por dia, mesmo vindo de IPs diferentes", async () => {
    const r: boolean[] = [];
    for (let i = 0; i < 4; i++) r.push(await consumirCotas([{ chave: "relatorio:email:alguem@exemplo.local", limite: 3 }, { chave: `relatorio:ip:10.0.0.${i}`, limite: 10 }]));
    expect(r).toEqual([true, true, true, false]);
  });
  it("vira o dia, a cota recomeça", async () => {
    const hoje = new Date(Date.UTC(2026, 10, 12, 15));
    for (let i = 0; i < 3; i++) await consumirCotas([{ chave: "x", limite: 3 }], hoje);
    expect(await consumirCotas([{ chave: "x", limite: 3 }], hoje)).toBe(false);
    expect(await consumirCotas([{ chave: "x", limite: 3 }], new Date(Date.UTC(2026, 10, 13, 15)))).toBe(true);
  });
  it("quando uma cota estoura, as outras não são gastas", async () => {
    for (let i = 0; i < 3; i++) await consumirCotas([{ chave: "a", limite: 3 }]);
    await consumirCotas([{ chave: "a", limite: 3 }, { chave: "b", limite: 10 }]);
    expect(tabela.get("cota:b")).toBeUndefined();
  });
});
