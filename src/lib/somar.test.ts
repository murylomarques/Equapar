import { describe, expect, it } from "vitest";
import { somarReais } from "./format";

describe("L10: totais em dinheiro com Decimal", () => {
  const valores = ["0.10", "0.20", "1234567.01", null, "0.07"];
  it("antes: somar com Number acumula erro de ponto flutuante", () => {
    expect(valores.reduce((s, v) => s + Number(v ?? 0), 0)).not.toBe(1234567.38);
  });
  it("agora: soma exata em centavos", () => {
    expect(somarReais(valores).toFixed(2)).toBe("1234567.38");
    expect(somarReais([]).toFixed(2)).toBe("0.00");
  });
});
