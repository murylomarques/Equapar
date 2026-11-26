import { describe, expect, it } from "vitest";
import { comUmPorCento, mesesVigencia, umPorCentoMensal, umPorCentoMensalTotal } from "./raio-x-valor";

// Raio-X: quanto vale 1% de reajuste por mês. Contratos fictícios.
describe("Raio-X: 1% de reajuste por mês", () => {
  it("meses de vigência arredondados (12 meses de calendário dão 12)", () => {
    expect(mesesVigencia("2026-03-10", "2027-03-10")).toBe(12);
    expect(mesesVigencia("2026-01-01", "2026-12-31")).toBe(12);
    expect(mesesVigencia("2025-07-01", "2027-12-31")).toBe(30);
  });

  it("vigência menor que 1 mês conta como 1", () => {
    expect(mesesVigencia("2026-11-01", "2026-11-10")).toBe(1);
    expect(umPorCentoMensal({ valorGlobal: 50_000, inicio: "2026-11-01", fim: "2026-11-10" })).toBe("500.00");
  });

  it("valor global ÷ meses × 1%, com 2 casas e sem erro de ponto flutuante", () => {
    expect(umPorCentoMensal({ valorGlobal: 1_200_000, inicio: "2026-03-10", fim: "2027-03-10" })).toBe("1000.00");
    // 100.000,10 ÷ 12 × 0,01 = 83,33341… → 83,33
    expect(umPorCentoMensal({ valorGlobal: 100_000.1, inicio: "2026-03-10", fim: "2027-03-10" })).toBe("83.33");
    // 1.000,50 × 0,01 = 10,005 exatos → 10,01 (em ponto flutuante daria 10,00499… → 10,00)
    expect(umPorCentoMensal({ valorGlobal: 1000.5, inicio: "2026-11-01", fim: "2026-11-20" })).toBe("10.01");
  });

  it("sem valor publicado ou sem datas válidas: nada", () => {
    expect(umPorCentoMensal({ valorGlobal: null, inicio: "2026-03-10", fim: "2027-03-10" })).toBeNull();
    expect(umPorCentoMensal({ valorGlobal: 0, inicio: "2026-03-10", fim: "2027-03-10" })).toBeNull();
    expect(umPorCentoMensal({ valorGlobal: 120_000, inicio: "", fim: "2027-03-10" })).toBeNull();
    expect(umPorCentoMensal({ valorGlobal: 120_000, inicio: "2026-03-10", fim: "" })).toBeNull();
    // início igual ao fim (o PNCP não trouxe o início) ou fim antes do início
    expect(umPorCentoMensal({ valorGlobal: 120_000, inicio: "2027-03-10", fim: "2027-03-10" })).toBeNull();
    expect(umPorCentoMensal({ valorGlobal: 120_000, inicio: "2027-03-10", fim: "2026-03-10" })).toBeNull();
  });

  it("total soma só os contratos com estimativa; nenhum: nada", () => {
    const contratos = [
      { valorGlobal: 1_200_000, inicio: "2026-03-10", fim: "2027-03-10" },
      { valorGlobal: 100_000.1, inicio: "2026-03-10", fim: "2027-03-10" },
      { valorGlobal: null, inicio: "2026-03-10", fim: "2027-03-10" },
    ];
    expect(umPorCentoMensalTotal(contratos)).toBe("1083.33");
    expect(umPorCentoMensalTotal([contratos[2]])).toBeNull();
    expect(umPorCentoMensalTotal([])).toBeNull();
    const r = comUmPorCento({ cnpj: "x", contratos });
    expect(r.contratos.map((c) => c.umPorCentoMes)).toEqual(["1000.00", "83.33", null]);
    expect(r.umPorCentoMesTotal).toBe("1083.33");
  });
});
