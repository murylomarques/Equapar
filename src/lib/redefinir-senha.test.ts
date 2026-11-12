import { describe, expect, it } from "vitest";
process.env.APP_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres-123";
const { lerTokenRedefinicao, tokenRedefinicao } = await import("./redefinir-senha");

const u = { id: "u1", senhaHash: "$2b$12$hash-antigo" };

describe("S11: link de redefinição de senha", () => {
  it("vale por 1 hora", () => {
    const t = tokenRedefinicao(u, 0);
    expect(lerTokenRedefinicao(t, u, 59 * 60_000)).toEqual({ ok: true });
    expect(lerTokenRedefinicao(t, u, 61 * 60_000)).toEqual({ erro: "vencido" });
  });
  it("serve uma vez só: depois que a senha muda, o mesmo link não vale", () => {
    const t = tokenRedefinicao(u, 0);
    expect(lerTokenRedefinicao(t, { id: "u1", senhaHash: "$2b$12$hash-novo" }, 1000)).toEqual({ erro: "usado" });
  });
  it("de outra pessoa ou alterado não vale", () => {
    const t = tokenRedefinicao(u, 0);
    expect(lerTokenRedefinicao(t, { id: "u2", senhaHash: u.senhaHash }, 0)).toEqual({ erro: "invalido" });
    expect(lerTokenRedefinicao(t.replace("u1", "u2"), u, 0)).toEqual({ erro: "invalido" });
  });
  it("conta só com Google (sem senha) também pode criar uma senha", () => {
    const g = { id: "u3", senhaHash: null };
    expect(lerTokenRedefinicao(tokenRedefinicao(g, 0), g, 0)).toEqual({ ok: true });
  });
});
