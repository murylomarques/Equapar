import { describe, expect, it } from "vitest";
import { calcularPlanilha, calcularRetroativo, compararPlanilhas } from "./motor";
import { agora, antes } from "../../../prisma/seed-demo";

// Seção 7.3: o caso do exemplo (dados fictícios do seed) precisa continuar dando os mesmos valores.
describe("Caso do exemplo (regressão do motor)", () => {
  it("R$ 5.219,15 por posto (Servente, planilha antes)", () => {
    const servente = calcularPlanilha(antes).postos.find((p) => p.nome === "Servente 44h")!;
    expect(servente.valorPorPosto).toBe("5219.15");
  });
  it("R$ 58.805,66 → R$ 62.070,27 por mês; diferença de R$ 3.264,61", () => {
    const c = compararPlanilhas(antes, agora);
    expect(c.erros).toEqual([]);
    expect([c.mensalAntes, c.mensalAgora, c.diferencaMensal]).toEqual(["58805.66", "62070.27", "3264.61"]);
  });
  it("retroativo de R$ 33.951,94, de 01/01/2026 a 12/11/2026", () => {
    const c = compararPlanilhas(antes, agora);
    expect(calcularRetroativo(c.diferencaMensal, new Date("2026-01-01T00:00:00Z"), new Date("2026-11-12T00:00:00Z")).total).toBe("33951.94");
  });
});
