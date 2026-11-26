import { describe, expect, it } from "vitest";
import { marcaCancelado, resumoFinanceiro, situacaoAposLancamentos, validarCancelamento } from "./financeiro-pedido";

// Cancelar nota fiscal ou recebimento lançado por engano: os totais e a situação do pedido só contam o que vale.
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const nf1 = { id: "nf1", identificacao: "101", emitidaEm: d("2026-09-01"), valor: "20000.00" };
const nf2 = { id: "nf2", identificacao: "102", emitidaEm: d("2026-09-10"), valor: "11540.20" };
const b1 = { id: "b1", notaFiscalId: "nf1", recebidoEm: d("2026-10-01"), valor: "20000.00" };
const b2 = { id: "b2", notaFiscalId: "nf2", recebidoEm: d("2026-10-05"), valor: "11540.20" };
const cancelada = { canceladaEm: d("2026-11-01") };

describe("situação do pedido depois de cancelar um lançamento", () => {
  it("tudo faturado e recebido: Dinheiro recebido", () => {
    const s = situacaoAposLancamentos("31540.20", [nf1, nf2], [b1, b2]);
    expect(s.estado).toBe("RECEBIDO");
    expect(s.valorRecebido).toBe("31540.20");
    expect(s.recebidoEm).toEqual(d("2026-10-05"));
  });

  it("cancelar um recebimento volta para Diferença faturada e o valor volta a constar a receber", () => {
    const s = situacaoAposLancamentos("31540.20", [nf1, nf2], [b1, { ...b2, ...cancelada }]);
    expect(s.estado).toBe("FATURADO");
    expect(s.valorRecebido).toBe("20000.00");
    expect(s.recebidoEm).toEqual(d("2026-10-01"));
    expect(s.resumo.faturadoAReceber).toBe("11540.20");
    expect(s.resumo.totalPendente).toBe("11540.20");
  });

  it("cancelar todos os recebimentos limpa a data e o valor recebidos", () => {
    const s = situacaoAposLancamentos("31540.20", [nf1], [{ ...b1, ...cancelada }]);
    expect(s).toMatchObject({ estado: "FATURADO", recebidoEm: null, valorRecebido: null, notaFiscal: "101" });
    expect(s.resumo.faltaFaturar).toBe("11540.20");
  });

  it("cancelar a única nota volta para Valor deferido, com tudo a faturar", () => {
    const s = situacaoAposLancamentos("31540.20", [{ ...nf1, ...cancelada }], []);
    expect(s).toMatchObject({ estado: "DEFERIDO", faturadoEm: null, notaFiscal: null, recebidoEm: null, valorRecebido: null });
    expect(s.resumo.faltaFaturar).toBe("31540.20");
    expect(s.resumo.faturado).toBe("0.00");
  });

  it("nota cancelada deixa de contar e a última nota válida vira a referência do pedido", () => {
    const s = situacaoAposLancamentos("31540.20", [nf1, { ...nf2, ...cancelada }], [b1]);
    expect(s.estado).toBe("FATURADO");
    expect(s.notaFiscal).toBe("101");
    expect(s.faturadoEm).toEqual(d("2026-09-01"));
    expect(resumoFinanceiro("31540.20", [nf1, { ...nf2, ...cancelada }], [b1]).faltaFaturar).toBe("11540.20");
  });
});

describe("regras do cancelamento", () => {
  it("exige motivo, recusa lançamento já cancelado ou de outro pedido", () => {
    expect(() => validarCancelamento("baixa", b1, [b1], "")).toThrow(/motivo/);
    expect(() => validarCancelamento("baixa", { ...b1, ...cancelada }, [b1], "valor errado")).toThrow(/já foi cancelado/);
    expect(() => validarCancelamento("nota", undefined, [], "valor errado")).toThrow(/não encontrada/);
    expect(() => validarCancelamento("baixa", b1, [b1], "valor errado")).not.toThrow();
  });

  it("nota com recebimento válido não é cancelada antes do recebimento", () => {
    expect(() => validarCancelamento("nota", nf1, [b1], "nota errada")).toThrow(/Cancele antes os recebimentos/);
    expect(() => validarCancelamento("nota", nf1, [{ ...b1, ...cancelada }], "nota errada")).not.toThrow();
  });

  it("o número e a referência cancelados ficam livres para o lançamento certo", () => {
    expect(marcaCancelado("101", "cmabc123456")).toBe("101 (cancelada 123456)");
    expect(marcaCancelado("101", "cmabc123456")).not.toBe("101");
  });
});
