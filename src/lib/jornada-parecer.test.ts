import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlanilhaCustos } from "./calculo/tipos";
import { compararPlanilhas } from "./calculo/motor";
import {
  divisorMensal,
  enquadramentoSugerido,
  horasExcedentes12x36,
  inicioNoContrato,
  pendenciasDoCenario,
  planilhaDoCenario,
  prazoAditivoDoContrato,
  tratamentoDoPosto,
  variacaoHoraPct,
} from "./jornada";

// Parecer do advogado de 28/11/2026. Dados fictícios.
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date | null) => x?.toISOString().slice(0, 10) ?? null;
const L = (id: string, modulo: string, descricao: string, valor: string, extra: object = {}) => ({ id, modulo, descricao, tipo: "VALOR", valor, ...extra }) as never;
const posto = (jornada?: object): PlanilhaCustos => ({
  tipos: [
    {
      id: "p",
      nome: "Servente",
      quantidade: 1,
      jornada: jornada as never,
      linhas: [L("sal", "M1", "Salário base", "2100.00", { salarioBase: true }), L("vt", "M2_3", "Vale-transporte", "260.00"), L("mat", "M5", "Materiais", "300.00")],
    },
  ],
});
const linha = (p: PlanilhaCustos, id: string) => p.tipos[0].linhas.find((l) => l.id === id);

describe("A1: prazo do aditivo pelo enquadramento", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("vigente na EC: 14/04/2027 com a cautelar; 16/10/2027 sem ela", () => {
    expect(iso(prazoAditivoDoContrato("VIGENTE_NA_EC"))).toBe("2027-04-14");
    vi.stubEnv("JORNADA_LIMINAR_VIGENTE", "false");
    expect(iso(prazoAditivoDoContrato("VIGENTE_NA_EC"))).toBe("2027-10-16");
  });
  it("licitação em andamento: 180 dias da assinatura; sem transição: nenhum prazo", () => {
    expect(iso(prazoAditivoDoContrato("LICITACAO_EM_ANDAMENTO", d("2026-11-20")))).toBe("2027-05-19");
    expect(prazoAditivoDoContrato("SEM_TRANSICAO")).toBeNull();
  });
  it("sugestão: assinado até 16/10/2026 é vigente; depois, a empresa informa", () => {
    expect(enquadramentoSugerido(d("2025-03-01"))).toBe("VIGENTE_NA_EC");
    expect(enquadramentoSugerido(d("2026-11-01"))).toBeNull();
  });
});

describe("A2: início da jornada no contrato", () => {
  it("aditivo até 16/12/2026 → 16/12/2026; depois, dentro do prazo → a data do aditivo; sem aditivo → fim do prazo", () => {
    expect(iso(inicioNoContrato("44-42", "VIGENTE_NA_EC", { dataAditivo: d("2026-12-01") }))).toBe("2026-12-16");
    expect(iso(inicioNoContrato("44-42", "VIGENTE_NA_EC", { dataAditivo: d("2027-02-10") }))).toBe("2027-02-10");
    expect(iso(inicioNoContrato("44-42", "VIGENTE_NA_EC"))).toBe("2027-04-14");
    expect(iso(inicioNoContrato("44-42", "VIGENTE_NA_EC", { dataAditivo: d("2027-06-01") }))).toBe("2027-04-14");
  });
  it("sem transição e etapa de 40 h: cronograma geral", () => {
    expect(iso(inicioNoContrato("44-42", "SEM_TRANSICAO"))).toBe("2026-12-16");
    expect(iso(inicioNoContrato("42-40", "VIGENTE_NA_EC"))).toBe("2027-12-16");
  });
});

describe("A4: método por tipo de posto", () => {
  it("referências: variação do valor da hora e divisores 220/210/200", () => {
    expect(variacaoHoraPct(44, 42).toFixed(4)).toBe("4.7619");
    expect(variacaoHoraPct(44, 40).toFixed(4)).toBe("10.0000");
    expect([44, 42, 40].map(divisorMensal)).toEqual([220, 210, 200]);
  });
  it("tabela do parecer: 44 e 43 adequam; 42 mantém na etapa de 42; 40, 36 e 30 mantêm; 12x36 apura", () => {
    expect(tratamentoDoPosto({ semanal: 43 }, 44, 42).tratamento).toBe("ADEQUAR");
    expect(tratamentoDoPosto({ semanal: 42 }, 44, 42).tratamento).toBe("MANTER");
    expect(tratamentoDoPosto({ semanal: 42 }, 42, 40).tratamento).toBe("ADEQUAR");
    expect(tratamentoDoPosto({ semanal: 36 }, 42, 40).tratamento).toBe("MANTER");
    expect(tratamentoDoPosto({ escala12x36: true }, 44, 42).tratamento).toBe("APURAR_12X36");
  });
  it("posto de 30 h não recebe o fator: diferença zero", () => {
    expect(compararPlanilhas(posto({ semanal: 30 }), planilhaDoCenario(posto({ semanal: 30 }), "MANTER_HORAS", 44, 42)).diferencaMensal).toBe("0.00");
  });
  it("dimensionamento informado pela empresa prevalece sobre a proporção das jornadas", () => {
    const n = planilhaDoCenario(posto({ empregadosAntes: 10, empregadosDepois: 11 }), "MANTER_HORAS", 44, 42);
    expect(linha(n, "sal")?.valor).toBe("2310.00");
    expect(linha(n, "sal")?.fonte).toContain("informados pela empresa");
    expect(linha(n, "mat")?.valor).toBe("300.00");
  });
  it("vale-transporte pelos dias trabalhados: 26 → 22 dias", () => {
    const n = planilhaDoCenario(posto({ semanal: 42, diasAntes: 26, diasDepois: 22 }), "MANTER_HORAS", 44, 42);
    expect(linha(n, "sal")?.valor).toBe("2100.00");
    expect(linha(n, "vt")?.valor).toBe("220.00");
  });
  it("12x36: na etapa de 42 h não há excedente; na de 40 h, horas excedentes com divisor 200 e adicional de 50%", () => {
    expect(horasExcedentes12x36(42).toNumber()).toBe(0);
    expect(linha(planilhaDoCenario(posto({ escala12x36: true }), "MANTER_HORAS", 44, 42), "jornada-he-12x36")).toBeUndefined();
    const n = planilhaDoCenario(posto({ escala12x36: true }), "MANTER_HORAS", 42, 40);
    // 2 h/semana × 52/12 = 8,6667 h/mês × (2.100 ÷ 200) × 1,5 = R$ 136,50
    expect(linha(n, "jornada-he-12x36")?.valor).toBe("136.50");
    expect(linha(n, "sal")?.valor).toBe("2100.00");
    expect(linha(planilhaDoCenario(posto({ escala12x36: true, compensar12x36: true }), "MANTER_HORAS", 42, 40), "jornada-he-12x36")).toBeUndefined();
  });
  it("a diferença pode ser negativa (menos dias trabalhados sem mudança de jornada)", () => {
    const atual = posto({ semanal: 40, diasAntes: 26, diasDepois: 22 });
    expect(Number(compararPlanilhas(atual, planilhaDoCenario(atual, "MANTER_HORAS", 44, 42)).diferencaMensal)).toBeLessThan(0);
  });
  it("reorganizar as escalas exige o dimensionamento informado", () => {
    expect(pendenciasDoCenario(posto(), "REORGANIZAR_ESCALAS")).toHaveLength(1);
    expect(pendenciasDoCenario(posto({ empregadosAntes: 4, empregadosDepois: 5 }), "REORGANIZAR_ESCALAS")).toHaveLength(0);
  });
});
