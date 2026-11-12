import { beforeEach, describe, expect, it, vi } from "vitest";

// C8: com as duas etapas ativas, iniciar a troca de aplicativo sem o código atual não pode mudar nada.
const u = { id: "u1", email: "dono@exemplo.local", nome: "Dono", senhaHash: "hash", totpAtivo: true, totpSegredoCifrado: "ATUAL", totpSegredoPendente: null as string | null, codigosRecuperacao: [] as string[] };
const atualizacoes: Record<string, unknown>[] = [];

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db", () => ({
  db: {
    usuario: {
      findUnique: vi.fn(async () => ({ ...u })),
      update: vi.fn(async ({ data }) => {
        atualizacoes.push(data);
        Object.assign(u, data);
        return u;
      }),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  exigirUsuario: vi.fn(async () => ({ usuario: { ...u } })),
  exigir: vi.fn(),
  novoTotp: vi.fn(() => ({ segredoCifrado: "NOVO", uri: "otpauth://totp/x" })),
  conferirTotp: vi.fn((segredo: string, codigo: string) => (segredo === "ATUAL" && codigo === "111111") || (segredo === "NOVO" && codigo === "222222")),
  conferirSenha: vi.fn(async (senha: string) => senha === "senha certa"),
  hashSenha: vi.fn(),
  senhaFraca: vi.fn(),
  encerrarSessao: vi.fn(),
  registrarHistorico: vi.fn(),
}));

const { iniciar2fa, confirmar2faConfig } = await import("./acoes");
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("C8: trocar o aplicativo das duas etapas", () => {
  beforeEach(() => {
    Object.assign(u, { totpAtivo: true, totpSegredoCifrado: "ATUAL", totpSegredoPendente: null, codigosRecuperacao: [] });
    atualizacoes.length = 0;
  });

  it("sem código nem senha, nada muda (antes: desligava as duas etapas)", async () => {
    const r = await (iniciar2fa as (a: unknown, b: FormData) => Promise<{ erro?: string }>)({}, fd({}));
    expect(r.erro).toBeTruthy();
    expect(u.totpAtivo).toBe(true);
    expect(u.totpSegredoCifrado).toBe("ATUAL");
    expect(atualizacoes).toEqual([]);
  });

  it("com o código atual, o segredo novo fica pendente e as duas etapas continuam ativas com o segredo atual", async () => {
    const r = await (iniciar2fa as (a: unknown, b: FormData) => Promise<{ erro?: string }>)({}, fd({ codigo: "111111" }));
    expect(r.erro).toBeUndefined();
    expect(u).toMatchObject({ totpAtivo: true, totpSegredoCifrado: "ATUAL", totpSegredoPendente: "NOVO" });
  });

  it("confirmar o novo troca o segredo e gera 10 códigos de recuperação (só os hashes ficam no banco)", async () => {
    u.totpSegredoPendente = "NOVO";
    const r = await confirmar2faConfig({}, fd({ codigo: "222222" }));
    expect(u).toMatchObject({ totpAtivo: true, totpSegredoCifrado: "NOVO", totpSegredoPendente: null });
    const codigos = r.dados?.codigos as string[];
    expect(codigos).toHaveLength(10);
    expect(u.codigosRecuperacao).toHaveLength(10);
    expect(u.codigosRecuperacao.some((h) => codigos.includes(h))).toBe(false);
  });
});
