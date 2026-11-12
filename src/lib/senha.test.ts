import { describe, expect, it } from "vitest";
import { senhaFraca } from "./senha";

describe("S10: senha segundo o NIST SP 800-63B", () => {
  it("sem regra de composição: frase longa só com letras é aceita (antes: exigia letras e números)", () => {
    expect(senhaFraca("cavalo correto bateria grampo")).toBeNull();
  });
  it("mínimo de 15 caracteres; 8 quando as duas etapas estão ativas", () => {
    expect(senhaFraca("Abc123!xyz")).toMatch(/15 caracteres/);
    expect(senhaFraca("Abc123!xyz", { duasEtapas: true })).toBeNull();
    expect(senhaFraca("Abc12!x", { duasEtapas: true })).toMatch(/8 caracteres/);
  });
  it("aceita até 64 caracteres", () => {
    expect(senhaFraca("o contrato de limpeza vence em dezembro e a convenção saiu já!!")).toBeNull();
    expect(senhaFraca("x".repeat(15) + "y".repeat(50))).toMatch(/64 caracteres/);
  });
  it("recusa senhas comuns, repetidas, sequências e o próprio e-mail", () => {
    expect(senhaFraca("123456789012345")).toMatch(/comum|fácil/);
    expect(senhaFraca("aaaaaaaaaaaaaaaa")).toMatch(/comum|fácil/);
    expect(senhaFraca("senhasenhasenha1")).toMatch(/comum|fácil/);
    expect(senhaFraca("Password123456789")).toMatch(/comum|fácil/);
    expect(senhaFraca("marcos.silva2026!", { email: "marcos.silva2026@exemplo.local" })).toMatch(/e-mail/);
  });
});
