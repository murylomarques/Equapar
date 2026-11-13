import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

// C7: caso fictício C1 do contador (5 rubricas × 44/42). O motor arredonda cada linha a 2 casas (meio para
// cima); a planilha de conferência do contador arredonda só no total. A diferença é de 1 centavo.
// Este teste REGISTRA os dois números; a regra do motor não muda (decisão do contador e do dono).
const RUBRICAS = ["1820.00", "324.20", "240.00", "480.00", "25.00"];
const FATOR = new Decimal(44).div(42);

describe("C7: arredondamento por linha × no total (caso C1)", () => {
  it("por linha (regra do motor): R$ 3.026,79", () => {
    const linhas = RUBRICAS.map((v) => new Decimal(v).times(FATOR).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
    expect(linhas.map((l) => l.toFixed(2))).toEqual(["1906.67", "339.64", "251.43", "502.86", "26.19"]);
    expect(linhas.reduce((a, b) => a.plus(b), new Decimal(0)).toFixed(2)).toBe("3026.79");
  });
  it("só no total (planilha do contador): R$ 3.026,78", () => {
    const total = RUBRICAS.reduce((a, v) => a.plus(v), new Decimal(0)).times(FATOR).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    expect(total.toFixed(2)).toBe("3026.78");
  });
});
