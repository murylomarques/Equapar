import { describe, expect, it } from "vitest";
import { calcularRetroativoCompetencias } from "./retroativo-competencias";

describe("retroativo por competência", () => {
  it("calcula 100 + 200 + metade de 300, menos abatimento de 50", () => {
    const r = calcularRetroativoCompetencias([
      { competencia: "2026-01", diferencaMensal: "100", dias: 30, divisor: 30 },
      { competencia: "2026-02", diferencaMensal: "200", dias: 30, divisor: 30 },
      { competencia: "2026-03", diferencaMensal: "300", dias: 15, divisor: 30 },
    ], "50");
    expect(r.bruto).toBe("450.00");
    expect(r.liquido).toBe("400.00");
  });

  it("detecta sobreposição", () => {
    expect(() => calcularRetroativoCompetencias([
      { competencia: "2026-01", diferencaMensal: "100", dias: 30, divisor: 30 },
      { competencia: "2026-01", diferencaMensal: "50", dias: 10, divisor: 30 },
    ])).toThrow(/sobreposta/);
  });
});
