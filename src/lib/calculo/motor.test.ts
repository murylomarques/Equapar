import { describe, expect, it } from "vitest";
import { calcularPlanilha, calcularRetroativo, compararPlanilhas, validarPlanilha, brl } from "./motor";
import { clonarPlanilha } from "./modelo";
import type { PlanilhaCustos } from "./tipos";

// Valores esperados calculados de forma independente (Python decimal, ROUND_HALF_UP por linha).
function exemplo(): PlanilhaCustos {
  return {
    tipos: [
      {
        id: "p1",
        nome: "Servente 44h",
        quantidade: 12,
        linhas: [
          { id: "sal", modulo: "M1", descricao: "Salário base", tipo: "VALOR", valor: "2000.00", salarioBase: true },
          { id: "ins", modulo: "M1", descricao: "Insalubridade", tipo: "PERCENTUAL", base: "SALARIO_BASE", valor: "20" },
          { id: "d13", modulo: "M2_1", descricao: "13º", tipo: "PERCENTUAL", base: "M1", valor: "8.33" },
          { id: "fer", modulo: "M2_1", descricao: "Férias", tipo: "PERCENTUAL", base: "M1", valor: "12.10" },
          { id: "inss", modulo: "M2_2", descricao: "INSS", tipo: "PERCENTUAL", base: "M1_M21", valor: "20" },
          { id: "fgts", modulo: "M2_2", descricao: "FGTS", tipo: "PERCENTUAL", base: "M1_M21", valor: "8" },
          { id: "vt", modulo: "M2_3", descricao: "VT", tipo: "VALOR", valor: "300.00" },
          { id: "dvt", modulo: "M2_3", descricao: "Desconto VT", tipo: "PERCENTUAL", base: "SALARIO_BASE", valor: "-6" },
          { id: "va", modulo: "M2_3", descricao: "VA", tipo: "VALOR", valor: "500.00" },
          { id: "res", modulo: "M3", descricao: "Rescisão", tipo: "PERCENTUAL", base: "M1", valor: "1" },
          { id: "rep", modulo: "M4", descricao: "Reposição", tipo: "PERCENTUAL", base: "M1_M3", valor: "2" },
          { id: "uni", modulo: "M5", descricao: "Uniformes", tipo: "VALOR", valor: "50.00" },
          { id: "ci", modulo: "M6_CI", descricao: "CI", tipo: "PERCENTUAL", base: "SUBTOTAL", valor: "3" },
          { id: "luc", modulo: "M6_LUCRO", descricao: "Lucro", tipo: "PERCENTUAL", base: "SUBTOTAL_CI", valor: "5" },
          { id: "iss", modulo: "M6_TRIBUTOS", descricao: "ISS", tipo: "PERCENTUAL", base: "POR_DENTRO", valor: "5" },
          { id: "pis", modulo: "M6_TRIBUTOS", descricao: "PIS", tipo: "PERCENTUAL", base: "POR_DENTRO", valor: "1.65" },
          { id: "cof", modulo: "M6_TRIBUTOS", descricao: "COFINS", tipo: "PERCENTUAL", base: "POR_DENTRO", valor: "7.6" },
        ],
      },
    ],
  };
}

describe("calcularPlanilha", () => {
  it("reproduz a conta independente módulo a módulo", () => {
    const r = calcularPlanilha(exemplo());
    expect(r.erros).toEqual([]);
    const p = r.postos[0];
    expect(p.totaisModulo.M1).toBe("2400.00");
    expect(p.totaisModulo.M2_1).toBe("490.32");
    expect(p.totaisModulo.M2_2).toBe("809.29");
    expect(p.totaisModulo.M2_3).toBe("680.00");
    expect(p.totaisModulo.M3).toBe("24.00");
    expect(p.totaisModulo.M4).toBe("88.07");
    expect(p.totaisModulo.M5).toBe("50.00");
    expect(p.totaisModulo.M6_CI).toBe("136.25");
    expect(p.totaisModulo.M6_LUCRO).toBe("233.90");
    const v = Object.fromEntries(p.linhas.map((l) => [l.id, l.valor]));
    expect(v.iss).toBe("286.40");
    expect(v.pis).toBe("94.51");
    expect(v.cof).toBe("435.34");
    expect(p.valorPorPosto).toBe("5728.08");
    expect(p.valorMensal).toBe("68736.96");
    expect(r.valorMensal).toBe("68736.96");
  });

  it("mantém a ordem das linhas e explica a conta em palavras", () => {
    const p = calcularPlanilha(exemplo()).postos[0];
    expect(p.linhas.map((l) => l.id)[0]).toBe("sal");
    expect(p.linhas.find((l) => l.id === "inss")!.conta).toContain("Módulo 1 + Submódulo 2.1");
  });

  it("é determinístico", () => {
    expect(JSON.stringify(calcularPlanilha(exemplo()))).toBe(JSON.stringify(calcularPlanilha(exemplo())));
  });
});

describe("validarPlanilha", () => {
  it("recusa número com vírgula, R$ ou texto", () => {
    const p = exemplo();
    p.tipos[0].linhas[0].valor = "2.000,00";
    expect(validarPlanilha(p).join(" ")).toContain("não é um número");
  });
  it("exige exatamente um salário base", () => {
    const p = exemplo();
    p.tipos[0].linhas[0].salarioBase = false;
    expect(validarPlanilha(p).join(" ")).toContain("salário base");
  });
  it("recusa base que ainda não foi calculada", () => {
    const p = exemplo();
    p.tipos[0].linhas[4].base = "SUBTOTAL";
    expect(validarPlanilha(p).join(" ")).toContain("não pode ser usada");
  });
  it("recusa alíquotas que somam 100% ou mais", () => {
    const p = exemplo();
    p.tipos[0].linhas[14].valor = "95";
    expect(validarPlanilha(p).join(" ")).toContain("menor que 100%");
  });
  it("não calcula nada quando há erro", () => {
    const p = exemplo();
    p.tipos[0].linhas[0].valor = "abc";
    const r = calcularPlanilha(p);
    expect(r.postos).toEqual([]);
    expect(r.erros.length).toBeGreaterThan(0);
  });
});

describe("compararPlanilhas", () => {
  it("diferença zero quando nada mudou", () => {
    const c = compararPlanilhas(exemplo(), exemplo());
    expect(c.diferencaMensal).toBe("0.00");
  });
  it("calcula a diferença quando o piso sobe", () => {
    const antes = exemplo();
    const agora = clonarPlanilha(antes);
    agora.tipos[0].linhas[0].valor = "2100.00";
    const c = compararPlanilhas(antes, agora);
    const sal = c.linhas.find((l) => l.id === "sal")!;
    expect(sal.variacao).toBe("100.00");
    expect(sal.variacaoPct).toBe("5.00");
    expect(Number(c.diferencaMensal)).toBeGreaterThan(0);
    expect(c.mensalAntes).toBe("68736.96");
  });
});

describe("calcularRetroativo", () => {
  it("pro rata no mês parcial e mês cheio nos demais", () => {
    const r = calcularRetroativo("1000.00", new Date("2026-01-15T00:00:00Z"), new Date("2026-03-31T00:00:00Z"));
    expect(r.meses.map((m) => m.valor)).toEqual(["548.39", "1000.00", "1000.00"]);
    expect(r.total).toBe("2548.39");
  });
  it("vazio se o fim é antes do início", () => {
    expect(calcularRetroativo("10", new Date("2026-05-01"), new Date("2026-04-01")).total).toBe("0.00");
  });
  it("atravessa a virada do ano", () => {
    const r = calcularRetroativo("310.00", new Date("2026-12-01T00:00:00Z"), new Date("2027-01-10T00:00:00Z"));
    expect(r.meses.map((m) => m.competencia)).toEqual(["2026-12", "2027-01"]);
    expect(r.meses[1].valor).toBe("100.00");
  });
});

describe("brl", () => {
  it("formata em reais", () => {
    expect(brl("1234567.891")).toBe("R$ 1.234.567,89");
    expect(brl("-120")).toBe("−R$ 120,00");
  });
});
