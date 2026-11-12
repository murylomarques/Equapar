import { beforeEach, describe, expect, it, vi } from "vitest";

// S6: completarEmpresa só com sessão completa (sem duas etapas pendentes) e sem criar conta duplicada por engano.
let sessao: { id: string; usuarioId: string; pendente2fa: boolean; usuario: { nome: string; email: string } } | null = null;
let membros = 0;
const criados: unknown[] = [];
class Redirect extends Error {
  constructor(public para: string) {
    super(`redirect ${para}`);
  }
}
vi.mock("next/navigation", () => ({ redirect: (p: string) => { throw new Redirect(p); } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth", () => ({
  sessaoAtual: async () => sessao,
  conferirSenha: vi.fn(), conferirTotp: vi.fn(), criarSessao: vi.fn(), encerrarSessao: vi.fn(), hashSenha: vi.fn(), senhaFraca: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    membro: { count: vi.fn(async () => membros), create: vi.fn(async (a) => (criados.push(a), { contaId: "nova" })) },
    sessao: { update: vi.fn() },
  },
}));
vi.mock("@/lib/eventos", () => ({ registrarEvento: vi.fn() }));
const { completarEmpresa } = await import("./acoes");
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const chamar = async (o: Record<string, string>) => {
  try {
    return await completarEmpresa({}, fd(o));
  } catch (e) {
    if (e instanceof Redirect) return { redirect: e.para };
    throw e;
  }
};

describe("S6: completarEmpresa", () => {
  beforeEach(() => {
    criados.length = 0;
    membros = 0;
    sessao = { id: "s", usuarioId: "u", pendente2fa: false, usuario: { nome: "Pessoa", email: "p@exemplo.local" } };
  });
  it("com as duas etapas pendentes, manda para o código e não cria nada", async () => {
    sessao!.pendente2fa = true;
    expect(await chamar({ tipo: "EMPRESA", cnpj: "11222333000181" })).toEqual({ redirect: "/entrar/2fa" });
    expect(criados).toHaveLength(0);
  });
  it("quem já tem conta não cria outra sem pedir explicitamente", async () => {
    membros = 1;
    expect(await chamar({ tipo: "EMPRESA", cnpj: "11222333000181" })).toEqual({ redirect: "/app/hoje" });
    expect(criados).toHaveLength(0);
  });
  it("segunda conta só pelo fluxo explícito (novaConta=1)", async () => {
    membros = 1;
    expect(await chamar({ tipo: "EMPRESA", cnpj: "11222333000181", novaConta: "1" })).toEqual({ redirect: "/app/boas-vindas" });
    expect(criados).toHaveLength(1);
  });
});
