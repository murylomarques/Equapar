import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlanilhaCustos } from "./calculo/tipos";
import { acompanhaPadrao, etapaNaData, fatorTexto, planilhaDoCenario, reducaoHorasPct } from "./jornada";

// D7: caso C1 (fictício) do contador, 5 rubricas por linha, 44 → 42 h.
const L = (id: string, modulo: string, descricao: string, valor: string) => ({ id, modulo, descricao, tipo: "VALOR", valor }) as never;
const caso: PlanilhaCustos = {
  tipos: [
    {
      id: "srv",
      nome: "Servente 44h",
      quantidade: 1,
      linhas: [
        { ...(L("sal", "M1", "Salário base", "1820.00") as object), salarioBase: true } as never,
        L("ins", "M1", "Adicional de insalubridade", "324.20"),
        L("vt", "M2_3", "Vale-transporte", "240.00"),
        L("va", "M2_3", "Vale-alimentação", "480.00"),
        L("uni", "M5", "Uniformes", "25.00"),
        L("mat", "M5", "Materiais de limpeza", "300.00"),
      ],
    },
  ],
};
const valor = (p: PlanilhaCustos, id: string) => p.tipos[0].linhas.find((l) => l.id === id)!;

describe("D2/D7: jornada sem inflar o salário", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("manter horas, 44 → 42: as 5 rubricas por linha", () => {
    const n = planilhaDoCenario(caso, "MANTER_HORAS", 44, 42);
    expect(["sal", "ins", "vt", "va", "uni"].map((id) => valor(n, id).valor)).toEqual(["1906.67", "339.64", "251.43", "502.86", "26.19"]);
  });
  it("a memória mostra o salário da convenção × empregados equivalentes (fator com 6 casas)", () => {
    const n = planilhaDoCenario(caso, "MANTER_HORAS", 44, 42);
    expect(fatorTexto(44, 42)).toBe("1,047619");
    expect(valor(n, "sal").fonte).toBe("R$ 1.820,00 × 1,047619 empregados equivalentes = R$ 1.906,67 por posto (EC 141/2026, jornada 44 para 42 h)");
  });
  it("materiais do módulo 5 não acompanham o número de empregados; uniformes acompanham (editável)", () => {
    expect(acompanhaPadrao({ modulo: "M5", descricao: "Materiais de limpeza" } as never)).toBe(false);
    expect(acompanhaPadrao({ modulo: "M5", descricao: "Uniformes" } as never)).toBe(true);
    expect(valor(planilhaDoCenario(caso, "MANTER_HORAS", 44, 42), "mat").valor).toBe("300.00");
    const semUniforme = { tipos: [{ ...caso.tipos[0], linhas: caso.tipos[0].linhas.map((l) => (l.id === "uni" ? { ...l, acompanhaEmpregados: false } : l)) }] };
    expect(valor(planilhaDoCenario(semUniforme, "MANTER_HORAS", 44, 42), "uni").valor).toBe("25.00");
  });
  it("reduzir horas: os valores por empregado não mudam; redução de 4,545% das horas", () => {
    const n = planilhaDoCenario(caso, "REDUZIR_HORAS", 44, 42);
    expect(n.tipos[0].linhas.map((l) => l.valor)).toEqual(caso.tipos[0].linhas.map((l) => l.valor));
    expect(reducaoHorasPct(44, 42).toFixed(3)).toBe("4.545");
  });
  it("D3: a etapa vale pela data; antes do início das 42 h, nenhuma; 44 → 40 num só aditivo não existe", () => {
    vi.stubEnv("JORNADA_42H_INICIO", "2026-12-16");
    vi.stubEnv("JORNADA_40H_INICIO", "2027-12-16");
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    expect(etapaNaData(d("2026-12-01"))).toBeNull();
    expect(etapaNaData(d("2026-12-16"))?.id).toBe("44-42");
    expect(etapaNaData(d("2027-12-15"))?.id).toBe("44-42");
    expect(etapaNaData(d("2027-12-16"))?.id).toBe("42-40");
  });
  // D7: o preço completo do posto (com encargos, insumos, custos indiretos, lucro e tributos) entra quando
  // chegar a planilha completa do caso C1 assinada pelo contador.
  it.todo("caso C1: preço completo do posto, conferido com a planilha assinada pelo contador");
});
