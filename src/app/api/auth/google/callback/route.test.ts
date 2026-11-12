import { beforeEach, describe, expect, it, vi } from "vitest";

// C7: alguém cadastra com senha o e-mail de outra pessoa; depois a dona do e-mail entra com o Google.
// Esperado: a senha antiga deixa de valer e as outras sessões caem.

type U = { id: string; email: string; nome: string; senhaHash: string | null; googleId: string | null; emailVerificadoEm: Date | null; totpAtivo: boolean };
const usuarios: U[] = [];
let sessoes: { id: string; usuarioId: string }[] = [];
const enviados: { destino: string; assunto: string }[] = [];

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "estado-ok" }), delete: () => {} }) }));
vi.mock("@/lib/auth", () => ({ criarSessao: vi.fn(async (usuarioId: string) => sessoes.push({ id: "nova", usuarioId })) }));
vi.mock("@/lib/mensagens", () => ({
  appUrl: (p = "") => `http://localhost${p}`,
  enviar: vi.fn(async (e: { destino: string; assunto: string }) => enviados.push(e)),
}));
vi.mock("@/lib/db", () => {
  const match = (u: U, w: Record<string, unknown>): boolean =>
    w.OR ? (w.OR as Record<string, unknown>[]).some((x) => match(u, x)) : Object.entries(w).every(([k, v]) => (u as never)[k] === v);
  return {
    db: {
      usuario: {
        findFirst: vi.fn(async ({ where }) => usuarios.find((u) => match(u, where)) ?? null),
        findUnique: vi.fn(async ({ where }) => usuarios.find((u) => match(u, where)) ?? null),
        create: vi.fn(async ({ data }) => {
          const u = { id: `u${usuarios.length + 1}`, senhaHash: null, googleId: null, emailVerificadoEm: null, totpAtivo: false, ...data };
          usuarios.push(u);
          return u;
        }),
        update: vi.fn(async ({ where, data }) => Object.assign(usuarios.find((u) => u.id === where.id)!, data)),
      },
      sessao: { deleteMany: vi.fn(async ({ where }) => (sessoes = sessoes.filter((s) => s.usuarioId !== where.usuarioId))) },
      membro: { findFirst: vi.fn(async () => ({ id: "m" })) },
    },
  };
});

process.env.GOOGLE_CLIENT_ID = "id";
process.env.GOOGLE_CLIENT_SECRET = "segredo";
const perfil = { sub: "google-123", email: "dona@exemplo.local", email_verified: true, name: "Dona do e-mail" };
vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string) => ({ ok: true, json: async () => (String(url).includes("token") ? { access_token: "t" } : perfil) })),
);

const { GET } = await import("./route");
const chamar = () => GET({ nextUrl: new URL("http://localhost/api/auth/google/callback?code=c&state=estado-ok") } as never);

describe("C7: login com Google numa conta que já existe com o mesmo e-mail", () => {
  beforeEach(() => {
    usuarios.length = 0;
    enviados.length = 0;
    sessoes = [];
  });

  it("e-mail não confirmado: liga o Google, confirma o e-mail, anula a senha, derruba as outras sessões e avisa", async () => {
    usuarios.push({ id: "u1", email: "dona@exemplo.local", nome: "Invasor", senhaHash: "hash-da-senha-do-invasor", googleId: null, emailVerificadoEm: null, totpAtivo: false });
    sessoes.push({ id: "sessao-do-invasor", usuarioId: "u1" });
    await chamar();
    const u = usuarios[0];
    expect(u.googleId).toBe("google-123");
    expect(u.senhaHash).toBeNull();
    expect(u.emailVerificadoEm).toBeInstanceOf(Date);
    expect(sessoes.map((s) => s.id)).toEqual(["nova"]);
    expect(enviados.map((e) => e.destino)).toEqual(["dona@exemplo.local"]);
  });

  it("e-mail já confirmado: liga o Google, mantém a senha e derruba as outras sessões", async () => {
    usuarios.push({ id: "u1", email: "dona@exemplo.local", nome: "Dona", senhaHash: "hash", googleId: null, emailVerificadoEm: new Date(), totpAtivo: false });
    sessoes.push({ id: "antiga", usuarioId: "u1" });
    await chamar();
    expect(usuarios[0].senhaHash).toBe("hash");
    expect(usuarios[0].googleId).toBe("google-123");
    expect(sessoes.map((s) => s.id)).toEqual(["nova"]);
  });

  it("conta nova pelo Google já nasce com o e-mail confirmado", async () => {
    await chamar();
    expect(usuarios[0].emailVerificadoEm).toBeInstanceOf(Date);
  });
});
