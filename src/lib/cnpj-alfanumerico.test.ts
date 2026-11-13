import { describe, expect, it } from "vitest";
import { cnpjAlfanumerico, cnpjValido, digitoCnpj, erroCnpj, mascaraCnpj, normalizarCnpj } from "./mascaras";
import { formatarCnpj } from "./cnpj";

// B3: exemplo oficial da Receita Federal (Perguntas e respostas do CNPJ alfanumérico, pergunta 14):
// 12.ABC.345/01DE → soma 459, resto 8, 1º dígito 3; com o 3, soma 424, resto 6, 2º dígito 5 → 12.ABC.345/01DE-35.
describe("B3: CNPJ alfanumérico", () => {
  it("calcula os dígitos do exemplo oficial", () => {
    expect(digitoCnpj("12ABC34501DE")).toBe(3);
    expect(digitoCnpj("12ABC34501DE3")).toBe(5);
    expect(cnpjValido("12.ABC.345/01DE-35")).toBe(true);
    expect(cnpjValido("12ABC34501DE35")).toBe(true);
  });
  it("aceita minúsculas e qualquer pontuação; guarda canônico", () => {
    expect(normalizarCnpj("12.abc.345/01de-35")).toBe("12ABC34501DE35");
    expect(cnpjValido("12.abc.345/01de-35")).toBe(true);
    expect(mascaraCnpj("12abc34501de35")).toBe("12.ABC.345/01DE-35");
    expect(formatarCnpj("12abc34501de35")).toBe("12.ABC.345/01DE-35");
    expect(cnpjAlfanumerico("12ABC34501DE35")).toBe(true);
  });
  it("recusa dígito errado e letra nos dígitos verificadores", () => {
    expect(cnpjValido("12ABC34501DE36")).toBe(false);
    expect(cnpjValido("12ABC34501DE3A")).toBe(false);
    expect(erroCnpj("12ABC34501DE3A")).toBe("Os 2 últimos caracteres do CNPJ são números.");
  });
  it("CNPJ numérico continua igual (mesmo cálculo, mesmos resultados)", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000180")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(formatarCnpj("1222333000181")).toBe("01.222.333/0001-81");
    expect(cnpjAlfanumerico("11222333000181")).toBe(false);
  });
});
