import { describe, expect, it } from "vitest";
process.env.APP_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres-123";
const { lerTokenConfirmacao, tokenConfirmacao } = await import("./confirmacao-email");

describe("C7: link de confirmação de e-mail", () => {
  it("vale por 24 horas", () => {
    const t = tokenConfirmacao("u1", "Pessoa@Exemplo.local", 0);
    expect(lerTokenConfirmacao(t, 23 * 3_600_000)).toEqual({ usuarioId: "u1", email: "pessoa@exemplo.local" });
    expect(lerTokenConfirmacao(t, 25 * 3_600_000)).toEqual({ erro: "vencido" });
  });
  it("alterado não vale", () => {
    const t = tokenConfirmacao("u1", "a@exemplo.local", 0).replace("u1", "u2");
    expect(lerTokenConfirmacao(t, 0)).toEqual({ erro: "invalido" });
    expect(lerTokenConfirmacao("lixo", 0)).toEqual({ erro: "invalido" });
  });
});
