import { describe, expect, it } from "vitest";
import { calcularRetroativo } from "./motor";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("L11: opções do retroativo (padrão = regra original)", () => {
  it("padrão continua igual: exemplo de 01/01/2026 a 12/11/2026 dá R$ 33.951,94", () => {
    expect(calcularRetroativo("3264.61", d("2026-01-01"), d("2026-11-12")).total).toBe("33951.94");
    expect(calcularRetroativo("3264.61", d("2026-01-01"), d("2026-11-12"), "DIAS_CORRIDOS").total).toBe("33951.94");
  });
  it("mês de 30 dias: novembro incompleto conta 12/30 em vez de 12/30 (igual) e fevereiro 15/30 em vez de 15/28", () => {
    const fev = calcularRetroativo("3000.00", d("2026-02-14"), d("2026-02-28"), "MES_30_DIAS");
    expect(fev.meses[0]).toMatchObject({ dias: 15, valor: "1500.00" });
    const fevCorridos = calcularRetroativo("3000.00", d("2026-02-14"), d("2026-02-28"));
    expect(fevCorridos.meses[0]).toMatchObject({ dias: 15, valor: "1607.14" });
  });
  it("mês de 31 dias incompleto com 31 dias contados é mês cheio nas duas regras", () => {
    expect(calcularRetroativo("3000.00", d("2026-03-01"), d("2026-03-31"), "MES_30_DIAS").total).toBe("3000.00");
  });
});
