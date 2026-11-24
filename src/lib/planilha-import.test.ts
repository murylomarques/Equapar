import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { importarExcel } from "./planilha-import";
import { calcularPlanilha } from "./calculo/motor";

async function planilha(linhas: (string | number)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Servente 44h");
  for (const l of linhas) {
    const row = ws.addRow(l);
    const v = row.getCell(3).value;
    if (typeof v === "number" && v > 0 && v < 1) row.getCell(3).numFmt = "0.00%";
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("importarExcel", () => {
  it("lê módulos, valores, percentuais e quantidade de postos", async () => {
    const buf = await planilha([
      ["", "Quantidade de postos", 10],
      ["", "MÓDULO 1 - COMPOSIÇÃO DA REMUNERAÇÃO", ""],
      ["A", "Salário base", 1740],
      ["B", "Adicional de insalubridade", 303.6],
      ["", "Total do Módulo 1", 2043.6],
      ["", "Submódulo 2.1 - 13º salário, férias e adicional de férias", ""],
      ["A", "13º salário", 0.0833],
      ["", "Submódulo 2.2 - GPS, FGTS e outras contribuições", ""],
      ["A", "INSS", 0.2],
      ["", "MÓDULO 6 - CUSTOS INDIRETOS, TRIBUTOS E LUCRO", ""],
      ["A", "Custos indiretos", 0.03],
      ["B", "Lucro", 0.05],
      ["C", "ISS", 0.05],
    ]);
    const r = await importarExcel(buf);
    expect(r.naoLidas).toEqual([]);
    const t = r.planilha.tipos[0];
    expect(t.quantidade).toBe(10);
    const por = Object.fromEntries(t.linhas.map((l) => [l.descricao, l]));
    expect(por["Salário base"]).toMatchObject({ modulo: "M1", tipo: "VALOR", valor: "1740", salarioBase: true });
    expect(por["Adicional de insalubridade"]).toMatchObject({ modulo: "M1", tipo: "VALOR", valor: "303.6" });
    expect(por["13º salário"]).toMatchObject({ modulo: "M2_1", tipo: "PERCENTUAL", valor: "8.33", base: "M1" });
    expect(por["INSS"]).toMatchObject({ modulo: "M2_2", tipo: "PERCENTUAL", valor: "20", base: "M1_M21" });
    expect(por["Custos indiretos"]).toMatchObject({ modulo: "M6_CI", valor: "3" });
    expect(por["Lucro"]).toMatchObject({ modulo: "M6_LUCRO", valor: "5" });
    expect(por["ISS"]).toMatchObject({ modulo: "M6_TRIBUTOS", base: "POR_DENTRO", valor: "5" });
    expect(t.linhas.some((l) => /total/i.test(l.descricao))).toBe(false);
    expect(calcularPlanilha(r.planilha).erros).toEqual([]);
  });

  it("tributo sem alíquota vai para conferência, sem inventar número", async () => {
    const buf = await planilha([
      ["", "MÓDULO 1", ""],
      ["A", "Salário base", 1500],
      ["", "MÓDULO 6 - CUSTOS INDIRETOS, TRIBUTOS E LUCRO", ""],
      ["A", "ISS", 85.4],
    ]);
    const r = await importarExcel(buf);
    expect(r.naoLidas.map((n) => n.motivo)).toContain("Tributo sem alíquota (%): informe a alíquota");
    expect(r.planilha.tipos[0].linhas.find((l) => l.descricao === "ISS")).toBeUndefined();
  });

  it("interpreta formatos locais sem multiplicar valores e preserva a célula de origem", async () => {
    const buf = await planilha([
      ["", "MÓDULO 1", ""],
      ["A", "Salário ponto decimal", "1800.00"],
      ["B", "Salário vírgula decimal", "1800,00"],
      ["C", "Salário milhar brasileiro", "1.800,00"],
      ["D", "Valor ambíguo", "1.800"],
    ]);
    const r = await importarExcel(buf);
    const linhas = r.planilha.tipos[0].linhas;
    expect(linhas.slice(0, 3).map((linha) => linha.valor)).toEqual(["1800", "1800", "1800"]);
    expect(linhas[0].origem).toMatchObject({ aba: "Servente 44h", linha: 2, celula: "C2", conteudo: "1800.00" });
    expect(r.naoLidas).toContainEqual(expect.objectContaining({ texto: "Valor ambíguo", impeditiva: true, status: "PENDENTE", celula: "C5" }));
  });

  it("lê múltiplas abas e fórmulas somente quando há resultado salvo", async () => {
    const wb = new ExcelJS.Workbook();
    const a = wb.addWorksheet("Posto A");
    a.addRow(["", "MÓDULO 1", ""]);
    a.addRow(["A", "Salário calculado", { formula: "900*2", result: 1800 }]);
    const b = wb.addWorksheet("Posto B");
    b.addRow(["", "MÓDULO 1", ""]);
    b.addRow(["A", "Salário sem cache", { formula: "950*2" }]);
    b.addRow(["B", "Célula com erro", { error: "#DIV/0!" }]);
    const r = await importarExcel(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(r.planilha.tipos.map((tipo) => tipo.nome)).toContain("Posto A");
    expect(r.planilha.tipos[0].linhas[0]).toMatchObject({ valor: "1800", origem: { tipo: "FORMULA_COM_RESULTADO", aba: "Posto A", celula: "C2" } });
    expect(r.naoLidas.map((linha) => linha.motivo)).toEqual(expect.arrayContaining(["Fórmula sem resultado salvo utilizável", "Célula com erro #DIV/0!"]));
    expect(r.naoLidas.every((linha) => linha.impeditiva && linha.status === "PENDENTE")).toBe(true);
  });
});
