import { describe, expect, it } from "vitest";
import { afetadoPelaJornada, empregadosPorPosto, fatorJornada, horasReduzidas, JORNADA, planilhaDoCenario } from "./jornada";
import { calcularPlanilha, compararPlanilhas } from "./calculo/motor";
import { antes } from "../../prisma/seed-demo";

describe("5.1: jornada de 40 horas", () => {
  it("fator e empregados por posto", () => {
    expect(fatorJornada(44, 40).toString()).toBe("1.1");
    expect(fatorJornada(44, 42).toDecimalPlaces(4).toString()).toBe("1.0476");
    expect(empregadosPorPosto(44, 40).toString()).toBe("1.1");
    expect(() => fatorJornada(40, 44)).toThrow();
  });
  it("manter as horas: o valor do posto sobe ~10% (44→40), pelo mesmo motor, com fonte em cada linha alterada", () => {
    const nova = planilhaDoCenario(antes, "MANTER_HORAS", 44, 40);
    const a = Number(calcularPlanilha(antes).postos[0].valorPorPosto);
    const n = Number(calcularPlanilha(nova).postos[0].valorPorPosto);
    expect(n / a).toBeGreaterThan(1.099);
    expect(n / a).toBeLessThan(1.101);
    const salario = nova.tipos[0].linhas.find((l) => l.salarioBase)!;
    expect(salario.fonte).toMatch(/EC 141\/2026/);
    // linhas em % não mudam (acompanham a base)
    const pct = antes.tipos[0].linhas.find((l) => l.tipo === "PERCENTUAL")!;
    expect(nova.tipos[0].linhas.find((l) => l.id === pct.id)!.valor).toBe(pct.valor);
  });
  it("reduzir as horas: planilha igual (diferença zero) e horas de serviço reduzidas", () => {
    const nova = planilhaDoCenario(antes, "REDUZIR_HORAS", 44, 40);
    expect(compararPlanilhas(antes, nova).diferencaMensal).toBe("0.00");
    expect(horasReduzidas(44, 44, 40).toString()).toBe("40");
  });
  it("contrato afetado: mão de obra dedicada, ativo e vigente na nova jornada", () => {
    const inicio = JORNADA.inicio42();
    expect(afetadoPelaJornada({ maoDeObraDedicada: true, arquivado: false, vigenciaFim: new Date(inicio.getTime() + 86_400_000) }, inicio)).toBe(true);
    expect(afetadoPelaJornada({ maoDeObraDedicada: false, arquivado: false, vigenciaFim: new Date(inicio.getTime() + 86_400_000) }, inicio)).toBe(false);
    expect(afetadoPelaJornada({ maoDeObraDedicada: true, arquivado: false, vigenciaFim: new Date(inicio.getTime() - 86_400_000) }, inicio)).toBe(false);
  });
});
