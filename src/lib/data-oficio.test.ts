import { describe, expect, it } from "vitest";
import { dataPorExtenso } from "./format";

describe("L8: data do ofício no fuso de Brasília", () => {
  const noite = new Date("2026-11-13T01:30:00Z"); // 12/11/2026 às 22h30 em Brasília
  it("antes: num servidor em UTC, o ofício sairia com o dia seguinte", () => {
    const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    expect(`${noite.getUTCDate()} de ${MESES[noite.getUTCMonth()]} de ${noite.getUTCFullYear()}`).toBe("13 de novembro de 2026");
  });
  it("agora: 12 de novembro de 2026, qualquer que seja o fuso do servidor", () => {
    expect(dataPorExtenso(noite)).toBe("12 de novembro de 2026");
    expect(dataPorExtenso(new Date("2026-01-01T02:59:00Z"))).toBe("31 de dezembro de 2025");
  });
});
