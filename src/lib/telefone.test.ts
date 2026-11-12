import { describe, expect, it } from "vitest";
import { ehPedidoParaSair, mesmoTelefone, normalizarTelefoneBR } from "./telefone";

describe("C5: normalizarTelefoneBR", () => {
  it.each([
    ["27999990000", "+5527999990000"], // 11 dígitos: celular com 9
    ["2733334444", "+552733334444"], // 10 dígitos: fixo
    ["(27) 99999-0000", "+5527999990000"], // com máscara
    ["552799990000", "+552799990000"], // 12 dígitos: 55 + DDD + 8 (sem o 9)
    ["5527999990000", "+5527999990000"], // 13 dígitos: 55 + DDD + 9
    ["+55 (27) 99999-0000", "+5527999990000"],
    ["11 98765-4321", "+5511987654321"],
  ])("%s -> %s", (entrada, esperado) => {
    expect(normalizarTelefoneBR(entrada)).toBe(esperado);
  });

  it.each(["", "123", "999999999999999", "(20) 99999-0000" /* DDD 20 não existe */, "(27) 89999-0000" /* 11 dígitos sem o 9 */, "0027999990000"])(
    "recusa %s",
    (entrada) => {
      expect(normalizarTelefoneBR(entrada)).toBeNull();
    },
  );
});

describe("C5: mesmoTelefone", () => {
  it("o WhatsApp manda sem o 9 e o cadastro tem o 9", () => {
    expect(mesmoTelefone("552799990000", "+5527999990000")).toBe(true);
  });
  it("cadastro antigo sem 55", () => {
    expect(mesmoTelefone("5527999990000", "27999990000")).toBe(true);
  });
  it("números diferentes", () => {
    expect(mesmoTelefone("5527999990000", "+5527999990001")).toBe(false);
    expect(mesmoTelefone("5527999990000", "+5521999990000")).toBe(false);
  });
  it("inválidos nunca batem", () => {
    expect(mesmoTelefone("", "")).toBe(false);
  });
});

describe("C5: pedido para sair", () => {
  it.each(["SAIR", "sair", " Sair ", "PARAR", "parar.", "Stop", "STOP!", "Saír"])("%s encerra", (t) => expect(ehPedidoParaSair(t)).toBe(true));
  it.each(["quero sair do grupo", "ok", ""])("%s não encerra", (t) => expect(ehPedidoParaSair(t)).toBe(false));
});
