import { describe, expect, it } from "vitest";
import { aReceber, estaAReceber, financeiroDoPedido, saldoAReceber } from "./a-receber";
import { resumoFinanceiro } from "./financeiro-pedido";

// Valores fictícios. Antes: Hoje somava o saldo líquido, Clientes o valor deferido bruto e o resumo semanal o deferido
// (ou a diferença retroativa) bruto. Agora as três telas usam a definição da tela A receber.
const pedido = (estado: string, extra: Partial<Parameters<typeof saldoAReceber>[0]> = {}) => ({
  estado,
  retroativoAprovado: null,
  valorDeferido: null,
  notasFiscais: [],
  baixas: [],
  ...extra,
});

describe("a receber: uma definição só", () => {
  it("só deferidos e faturados entram", () => {
    expect(["DEFERIDO", "FATURADO", "RECEBIDO", "PROTOCOLADO", "INDEFERIDO", "EM_ANALISE"].filter((e) => estaAReceber({ estado: e }))).toEqual(["DEFERIDO", "FATURADO"]);
    expect(saldoAReceber(pedido("RECEBIDO", { valorDeferido: "1000" }))).toBe("0.00");
  });

  it("a base é o retroativo aprovado; sem ele, o valor deferido", () => {
    expect(saldoAReceber(pedido("DEFERIDO", { retroativoAprovado: "31540.20", valorDeferido: "40000" }))).toBe("31540.20");
    expect(saldoAReceber(pedido("DEFERIDO", { valorDeferido: "40000" }))).toBe("40000.00");
    expect(saldoAReceber(pedido("DEFERIDO"))).toBe("0.00");
  });

  it("desconta só o que já entrou (baixas válidas de notas válidas), como a tela A receber", () => {
    const p = pedido("FATURADO", {
      retroativoAprovado: "31540.20",
      notasFiscais: [
        { id: "nf1", valor: "20000" },
        { id: "nf2", valor: "11540.20", canceladaEm: new Date("2026-11-01T00:00:00Z") },
      ],
      baixas: [
        { notaFiscalId: "nf1", valor: "5000" },
        { notaFiscalId: "nf1", valor: "1000", canceladaEm: new Date("2026-11-02T00:00:00Z") },
        { notaFiscalId: "nf2", valor: "11540.20" },
      ],
    });
    expect(saldoAReceber(p)).toBe("26540.20");
    expect(saldoAReceber(p)).toBe(resumoFinanceiro("31540.20", p.notasFiscais, p.baixas).totalPendente);
    expect(financeiroDoPedido(p).faturado).toBe("20000.00");
  });

  it("o total soma os saldos, sem erro de ponto flutuante, e ignora os outros estados", () => {
    const r = aReceber([
      pedido("DEFERIDO", { valorDeferido: "0.10" }),
      pedido("FATURADO", { retroativoAprovado: "0.20" }),
      pedido("RECEBIDO", { valorDeferido: "999" }),
    ]);
    expect(r.itens).toHaveLength(2);
    expect(r.total.toFixed(2)).toBe("0.30");
  });
});
