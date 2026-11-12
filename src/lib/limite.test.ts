import { beforeEach, describe, expect, it, vi } from "vitest";

// Tabela TentativaAcesso simulada em memória
const tabela = new Map<string, { chave: string; falhas: number; janelaAte: Date; bloqueadoAte: Date | null }>();
vi.mock("./db", () => ({
  db: {
    tentativaAcesso: {
      findMany: vi.fn(async ({ where }) => [...tabela.values()].filter((t) => where.chave.in.includes(t.chave))),
      findUnique: vi.fn(async ({ where }) => tabela.get(where.chave) ?? null),
      upsert: vi.fn(async ({ where, create, update }) => {
        const t = tabela.get(where.chave);
        const novo = t ? { ...t, ...update } : { ...create };
        tabela.set(where.chave, novo);
        return novo;
      }),
      deleteMany: vi.fn(async ({ where }) => tabela.delete(where.chave)),
    },
  },
}));

const { chavesDeAcesso, estaBloqueado, registrarFalha, limparTentativas, proximaTentativa } = await import("./limite");

const cab = (h: Record<string, string>) => new Headers(h);

describe("S1: limite no banco, por e-mail e por IP de proxy confiável", () => {
  beforeEach(() => {
    tabela.clear();
    delete process.env.TRUSTED_PROXY_HEADER;
  });

  it("sem proxy confiável configurado, o X-Forwarded-For é ignorado", () => {
    expect(chavesDeAcesso("Dono@Exemplo.local", cab({ "x-forwarded-for": "9.9.9.9" }))).toEqual(["email:dono@exemplo.local"]);
  });

  it("com proxy confiável, usa o IP do cabeçalho configurado", () => {
    process.env.TRUSTED_PROXY_HEADER = "cf-connecting-ip";
    expect(chavesDeAcesso("a@exemplo.local", cab({ "cf-connecting-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1" }))).toEqual(["email:a@exemplo.local", "ip:8.8.8.8"]);
  });

  it("5 falhas no mesmo e-mail bloqueiam, mesmo trocando o X-Forwarded-For", async () => {
    for (let i = 0; i < 5; i++) await registrarFalha(chavesDeAcesso("dono@exemplo.local", cab({ "x-forwarded-for": `1.1.1.${i}` })));
    expect(await estaBloqueado(chavesDeAcesso("dono@exemplo.local", cab({ "x-forwarded-for": "2.2.2.2" })))).toBe(true);
  });

  it("acertar limpa o contador do e-mail", async () => {
    const ch = chavesDeAcesso("dono@exemplo.local", cab({}));
    for (let i = 0; i < 4; i++) await registrarFalha(ch);
    await limparTentativas("dono@exemplo.local");
    await registrarFalha(ch);
    expect(await estaBloqueado(ch)).toBe(false);
  });

  it("regra pura: janela de 15 minutos; bloqueio de 15 minutos ao atingir o limite", () => {
    const t0 = new Date(Date.UTC(2026, 10, 12, 12));
    let e = proximaTentativa(null, t0, 5);
    for (let i = 0; i < 4; i++) e = proximaTentativa(e, t0, 5);
    expect(e.falhas).toBe(5);
    expect(e.bloqueadoAte?.getTime()).toBe(t0.getTime() + 15 * 60_000);
    const depois = new Date(t0.getTime() + 16 * 60_000);
    expect(proximaTentativa(e, depois, 5).falhas).toBe(1); // janela venceu: recomeça
  });
});
