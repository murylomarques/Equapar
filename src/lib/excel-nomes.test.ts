import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { nomeAbaUnico } from "./excel-nomes";

const antigo = (r: string, p: string) => `${r} - ${p}`.slice(0, 31).replace(/[\\/*?:[\]]/g, " ");

describe("C4: nomes de aba do Excel", () => {
  it("reproduz a falha antiga: dois postos parecidos viram a mesma aba", () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet(antigo("Planilha nova", "Auxiliar de limpeza 44h diurno"));
    expect(() => wb.addWorksheet(antigo("Planilha nova", "Auxiliar de limpeza 44h noturno"))).toThrow(/already exists/);
  });

  it("dois nomes iguais nos primeiros caracteres ganham sufixo e o ExcelJS aceita", () => {
    const usados = new Set<string>();
    const wb = new ExcelJS.Workbook();
    const a = nomeAbaUnico("Planilha nova - Auxiliar de limpeza 44h diurno", usados);
    const b = nomeAbaUnico("Planilha nova - Auxiliar de limpeza 44h noturno", usados);
    wb.addWorksheet(a);
    wb.addWorksheet(b);
    expect(a).not.toBe(b);
    expect(b.endsWith(" (2)")).toBe(true);
    expect(Math.max(a.length, b.length)).toBeLessThanOrEqual(31);
  });

  it("12 postos com os mesmos 28 primeiros caracteres: todos únicos, até 31 caracteres", () => {
    const usados = new Set<string>();
    const wb = new ExcelJS.Workbook();
    const nomes = Array.from({ length: 12 }, (_, i) => nomeAbaUnico(`Planilha nova - Auxiliar de limpeza turno ${i + 1}`, usados));
    nomes.forEach((n) => wb.addWorksheet(n));
    expect(new Set(nomes.map((n) => n.toLowerCase())).size).toBe(12);
    expect(nomes.every((n) => n.length <= 31)).toBe(true);
    expect(nomes[11]).toMatch(/\(12\)$/);
  });

  it("não diferencia maiúsculas, tira caracteres proibidos e respeita abas reservadas", () => {
    const usados = new Set(["comparativo", "retroativo"]);
    expect(nomeAbaUnico("Comparativo", usados)).toBe("Comparativo (2)");
    expect(nomeAbaUnico("RETROATIVO", usados)).toBe("RETROATIVO (2)");
    expect(nomeAbaUnico("Posto: A/B [noite]?", usados)).toBe("Posto A B noite");
    expect(nomeAbaUnico("'aspas'", usados)).toBe("aspas");
    expect(nomeAbaUnico("", usados)).toBe("Aba");
  });
});
