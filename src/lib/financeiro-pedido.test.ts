import { describe, expect, it } from "vitest";
import { resumoFinanceiro, validarLancamento } from "./financeiro-pedido";

describe("faturamento e baixas parciais", () => {
  it("mantém 11.540,20 para faturar depois de uma nota de 20 mil", () => {
    expect(resumoFinanceiro("31540.20", [{ id: "nf1", valor: "20000" }], []).faltaFaturar).toBe("11540.20");
  });

  it("mantém R$ 30.540,20 em aberto depois de uma baixa de R$ 1.000,00", () => {
    const r = resumoFinanceiro("31540.20", [{ id: "nf1", valor: "31540.20" }], [{ notaFiscalId: "nf1", valor: "1000" }]);
    expect(r.faturadoAReceber).toBe("30540.20");
    expect(r.totalPendente).toBe("30540.20");
    expect(r.quitado).toBe(false);
  });

  it("recusa zero, negativo e valor acima do saldo", () => {
    expect(() => validarLancamento(0, 100)).toThrow(/maior que zero/);
    expect(() => validarLancamento(-1, 100)).toThrow(/maior que zero/);
    expect(() => validarLancamento(101, 100)).toThrow(/supera o saldo/);
  });
});
