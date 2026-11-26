import { describe, expect, it } from "vitest";
import { anosComMovimento, mesesDeVigencia, pedidosEmAndamento, relatorioDoAno, textoCasoPronto, valorMensalReferencia, type PedidoDoAno } from "./relatorios";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const vig = { vigenciaInicio: d("2026-01-01"), vigenciaFim: d("2026-12-31") };

describe("cada 1% de reajuste (estimativa)", () => {
  it("usa o valor mensal cadastrado", () => {
    expect(valorMensalReferencia({ ...vig, valorMensal: "58805.66", valorGlobal: "999999" })).toEqual({ valor: "58805.66", origem: "contrato", umPorCento: "588.06" });
  });
  it("sem valor mensal, usa o último valor registrado até hoje", () => {
    const r = valorMensalReferencia({ ...vig, valorMensal: null, valorGlobal: null }, [
      { valorNovo: "50000", aplicavelEm: d("2026-03-01") },
      { valorNovo: "62070.27", aplicavelEm: d("2026-09-01") },
      { valorNovo: "70000", aplicavelEm: d("2027-03-01") },
    ], d("2026-11-26"));
    expect(r).toMatchObject({ valor: "62070.27", origem: "historico", umPorCento: "620.70" });
  });
  it("sem valor mensal nem histórico, valor global ÷ meses de vigência", () => {
    expect(valorMensalReferencia({ ...vig, valorMensal: null, valorGlobal: "120000.00" })).toEqual({ valor: "10000.00", origem: "global", meses: 12, umPorCento: "100.00" });
  });
  it("sem nenhum valor, nada (a tela diz 'valor não informado')", () => {
    expect(valorMensalReferencia({ ...vig, valorMensal: null, valorGlobal: null })).toBeNull();
    expect(valorMensalReferencia({ ...vig, valorMensal: "0", valorGlobal: "0" })).toBeNull();
  });
  it("meses de vigência com o fim inclusive", () => {
    expect(mesesDeVigencia(d("2026-01-01"), d("2026-12-31"))).toBe(12);
    expect(mesesDeVigencia(d("2026-03-15"), d("2027-03-14"))).toBe(12);
    expect(mesesDeVigencia(d("2026-01-01"), d("2030-12-31"))).toBe(60);
    expect(mesesDeVigencia(d("2026-01-01"), d("2026-01-10"))).toBe(1);
  });
});

describe("resumo para o sócio: pedidos em andamento e deferido não recebido", () => {
  it("agrupa por situação e soma o saldo como a tela A receber", () => {
    const r = pedidosEmAndamento([
      { estado: "EM_ANALISE", diferencaMensal: "100.00", diferencaRetroativa: "1000.00", retroativoAprovado: null, valorDeferido: null, notasFiscais: [], baixas: [] },
      { estado: "PROTOCOLADO", diferencaMensal: "200.00", diferencaRetroativa: "2000.00", retroativoAprovado: null, valorDeferido: null, notasFiscais: [], baixas: [] },
      { estado: "PROTOCOLADO", diferencaMensal: null, diferencaRetroativa: "500.50", retroativoAprovado: null, valorDeferido: null, notasFiscais: [], baixas: [] },
      { estado: "DEFERIDO", diferencaMensal: "300", diferencaRetroativa: "3000", retroativoAprovado: "2500.00", valorDeferido: "2500.00", notasFiscais: [], baixas: [] },
      {
        estado: "FATURADO",
        diferencaMensal: "10",
        diferencaRetroativa: "100",
        retroativoAprovado: "1000.00",
        valorDeferido: null,
        notasFiscais: [{ id: "n1", valor: "1000.00" }],
        baixas: [{ notaFiscalId: "n1", valor: "400.00" }, { notaFiscalId: "n1", valor: "100.00", canceladaEm: d("2026-11-01") }],
      },
      { estado: "RECEBIDO", diferencaMensal: "999", diferencaRetroativa: "999", retroativoAprovado: "999", valorDeferido: null, notasFiscais: [], baixas: [] },
    ]);
    expect(r.porSituacao.map((s) => s.estado)).toEqual(["EM_ANALISE", "PROTOCOLADO", "DEFERIDO", "FATURADO"]);
    expect(r.porSituacao[1]).toEqual({ estado: "PROTOCOLADO", quantidade: 2, diferencaMensal: "200.00", retroativo: "2500.50" });
    expect(r.deferidoNaoRecebido).toBe("3100.00"); // 2.500 + (1.000 − 400; a baixa cancelada não conta)
    expect(r.pedidosAReceber).toBe(2);
  });
});

const pedido = (p: Partial<PedidoDoAno> & { contrato: PedidoDoAno["contrato"] }): PedidoDoAno => ({
  geradoEm: null,
  diferencaMensal: null,
  diferencaRetroativa: null,
  deferidoEm: null,
  retroativoAprovado: null,
  valorDeferido: null,
  mensalAprovado: null,
  mensalVigenteAnterior: null,
  recebidoEm: null,
  valorRecebido: null,
  notasFiscais: [],
  baixas: [],
  ...p,
});
const k1 = { id: "k1", numero: "10/2025", orgao: "Órgão Exemplo A" };
const k2 = { id: "k2", numero: "2/2026", orgao: "Órgão Exemplo B" };

describe("relatório do ano", () => {
  const pedidos = [
    pedido({
      contrato: k1,
      geradoEm: d("2026-02-10"),
      diferencaMensal: "3264.61",
      diferencaRetroativa: "33951.94",
      deferidoEm: d("2026-05-02"),
      mensalAprovado: "62070.27",
      mensalVigenteAnterior: "58805.66",
      retroativoAprovado: "30000.00",
      notasFiscais: [
        { id: "n1", valor: "20000.00", emitidaEm: d("2026-06-01") },
        { id: "n2", valor: "10000.00", emitidaEm: d("2026-06-02"), canceladaEm: d("2026-06-03") },
        { id: "n3", valor: "10000.00", emitidaEm: d("2027-01-05") },
      ],
      baixas: [
        { notaFiscalId: "n1", valor: "15000.00", recebidoEm: d("2026-07-01") },
        { notaFiscalId: "n1", valor: "5000.00", recebidoEm: d("2026-07-02"), canceladaEm: d("2026-07-03") },
        { notaFiscalId: "n1", valor: "5000.00", recebidoEm: d("2027-01-10") },
      ],
    }),
    // gerado no ano anterior: não conta como montado em 2026, mas o deferimento em 2026 conta
    pedido({ contrato: k2, geradoEm: d("2025-12-01"), diferencaMensal: "100", diferencaRetroativa: "1200", deferidoEm: d("2026-01-20"), valorDeferido: "1100.00" }),
    // pedido antigo sem baixas registradas: o recebido gravado no pedido entra
    pedido({ contrato: k2, recebidoEm: d("2026-03-03"), valorRecebido: "800.00" }),
    // sem movimento no ano: some da lista
    pedido({ contrato: { id: "k3", numero: "3/2024", orgao: "Órgão C" }, geradoEm: d("2024-05-05"), diferencaMensal: "50" }),
  ];

  it("soma por contrato só o que aconteceu no ano, sem cancelados", () => {
    const r = relatorioDoAno(pedidos, 2026);
    expect(r.linhas.map((l) => l.numero)).toEqual(["2/2026", "10/2025"]);
    expect(r.linhas[1]).toEqual({
      contratoId: "k1",
      numero: "10/2025",
      orgao: "Órgão Exemplo A",
      montados: 1,
      mensalPedido: "3264.61",
      retroativoPedido: "33951.94",
      deferidos: 1,
      mensalDeferido: "3264.61",
      retroativoDeferido: "30000.00",
      faturado: "20000.00",
      recebido: "15000.00",
    });
    expect(r.linhas[0]).toMatchObject({ montados: 0, mensalPedido: "0.00", deferidos: 1, retroativoDeferido: "1100.00", mensalDeferido: "0.00", recebido: "800.00" });
    expect(r.total).toEqual({
      montados: 1,
      mensalPedido: "3264.61",
      retroativoPedido: "33951.94",
      deferidos: 2,
      mensalDeferido: "3264.61",
      retroativoDeferido: "31100.00",
      faturado: "20000.00",
      recebido: "15800.00",
    });
  });

  it("o ano seguinte pega a nota e a baixa de janeiro", () => {
    const r = relatorioDoAno(pedidos, 2027);
    expect(r.total).toMatchObject({ montados: 0, faturado: "10000.00", recebido: "5000.00" });
  });

  it("anos com movimento, do mais recente", () => {
    expect(anosComMovimento(pedidos, d("2026-11-26"))).toEqual([2027, 2026, 2025, 2024]);
  });
});

describe("caso pronto", () => {
  const dados = {
    contrato: { numero: "10/2025", orgao: "Prefeitura de Exemplo", esfera: "M", uf: "ES", objeto: "Limpeza" },
    categoria: "Asseio e conservação",
    protocoloData: d("2026-02-10"),
    deferidoEm: d("2026-03-12"),
    recebidoEm: d("2026-05-11"),
    recebido: "30000.00",
    diferencaMensalPedida: "3264.61",
    mensalAprovado: "62070.27",
    mensalVigenteAnterior: "58805.66",
    retroativoAprovado: "30000.00",
  };
  it("anônimo por padrão: tipo de órgão, UF e categoria, sem nome nem número", () => {
    const t = textoCasoPronto(dados);
    expect(t.titulo).toBe("R$ 30.000,00 recebidos num contrato com órgão municipal (ES)");
    expect(t.markdown).not.toContain("Prefeitura de Exemplo");
    expect(t.markdown).not.toContain("10/2025");
    expect(t.markdown).toContain("asseio e conservação");
    expect(t.markdown).toContain("Aumento mensal aprovado: R$ 3.264,61 por mês");
    expect(t.markdown).toContain("Deferimento: 12/03/2026 (30 dias depois do protocolo)");
    expect(t.markdown).toContain("Recebimento: 11/05/2026 (60 dias depois do deferimento)");
    expect(t.markdown).toContain("autorização assinada do cliente");
  });
  it("identificado só quando pedido", () => {
    expect(textoCasoPronto(dados, { identificado: true }).titulo).toBe("R$ 30.000,00 recebidos no contrato 10/2025 com Prefeitura de Exemplo");
  });
});
