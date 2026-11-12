import { describe, expect, it, vi } from "vitest";

// S12: quem convida não vê senha; a pessoa convidada recebe um link (7 dias) e define a própria senha.
process.env.APP_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres-123";
const usuarios: { id: string; email: string; nome: string; senhaHash: string | null }[] = [];
const enviados: { destino: string; corpo: string }[] = [];
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db", () => ({
  db: {
    usuario: {
      findUnique: vi.fn(async ({ where }) => usuarios.find((u) => u.email === where.email) ?? null),
      create: vi.fn(async ({ data }) => {
        const u = { id: `u${usuarios.length + 1}`, senhaHash: null, ...data };
        usuarios.push(u);
        return u;
      }),
    },
    membro: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({})) },
  },
}));
vi.mock("@/lib/mensagens", () => ({ appUrl: (p = "") => `http://localhost${p}`, enviar: vi.fn(async (e) => enviados.push(e)) }));
vi.mock("@/lib/auth", () => ({
  exigir: vi.fn(async () => ({ conta: { id: "c1", nome: "Conta Exemplo" }, usuario: { nome: "Dono" } })),
  exigirUsuario: vi.fn(),
  registrarHistorico: vi.fn(),
  conferirSenha: vi.fn(),
  conferirTotp: vi.fn(),
  hashSenha: vi.fn(async (s: string) => `hash:${s}`),
  novoTotp: vi.fn(),
  senhaFraca: vi.fn(),
  encerrarSessao: vi.fn(),
}));

const { convidarPessoa } = await import("./acoes");
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("S12: convite", () => {
  it("cria a pessoa sem senha, não mostra senha a quem convida e manda um link de convite", async () => {
    const r = await convidarPessoa({}, fd({ nome: "Pessoa Convidada", email: "convidada@exemplo.local", papel: "GERENTE" }));
    expect(r.erro).toBeUndefined();
    expect(r.ok).not.toMatch(/senha/i);
    expect(usuarios[0].senhaHash).toBeNull();
    expect(enviados[0].corpo).toMatch(/\/convite\?t=/);
    expect(enviados[0].corpo).toMatch(/7 dias/);
  });
});
