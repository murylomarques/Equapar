import { describe, expect, it } from "vitest";
process.env.APP_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres-123";
const { conviteValido, lerTokenConvite, tokenConvite } = await import("./convite");

describe("S12: link de convite", () => {
  const u = { id: "u1", senhaHash: null };
  it("vale por 7 dias", () => {
    const t = lerTokenConvite(tokenConvite(u, "c1", 0));
    expect(t?.contaId).toBe("c1");
    expect(conviteValido(t, u, 6 * 86_400_000)).toBe("ok");
    expect(conviteValido(t, u, 8 * 86_400_000)).toBe("vencido");
  });
  it("deixa de valer depois que a pessoa define a senha", () => {
    const t = lerTokenConvite(tokenConvite(u, "c1", 0));
    expect(conviteValido(t, { id: "u1", senhaHash: "hash" }, 0)).toBe("usado");
  });
  it("alterado ou de outra pessoa não vale", () => {
    expect(lerTokenConvite(tokenConvite(u, "c1", 0).replace("c1", "c2"))).toBeNull();
    expect(conviteValido(lerTokenConvite(tokenConvite(u, "c1", 0)), { id: "u2", senhaHash: null }, 0)).toBe("invalido");
  });
});
