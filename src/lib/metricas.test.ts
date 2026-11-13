import { afterEach, describe, expect, it, vi } from "vitest";
import { custoPorAquisicao, margemEmReais, medianaDiasMontagem, mostrarPesquisa, novasPagantes, podeVerPainel, recuperadoNoPrazoPorMes, resultadoSeanEllis, retencao, tempoPorPlano } from "./metricas";

const d = (s: string) => new Date(`${s}T12:00:00Z`);

describe("4.4: métricas do painel interno", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("valor recuperado no prazo: só pedidos protocolados até o fim da vigência, por mês do deferimento", () => {
    expect(
      recuperadoNoPrazoPorMes([
        { valorDeferido: "1000.10", deferidoEm: d("2026-10-05"), protocoloData: d("2026-08-01"), fimVigencia: d("2026-09-01") },
        { valorDeferido: "500.20", deferidoEm: d("2026-10-20"), protocoloData: d("2026-08-15"), fimVigencia: d("2026-12-01") },
        { valorDeferido: "999.00", deferidoEm: d("2026-10-25"), protocoloData: d("2026-12-15"), fimVigencia: d("2026-12-01") }, // fora do prazo
        { valorDeferido: "300.00", deferidoEm: d("2026-11-02"), protocoloData: d("2026-09-01"), fimVigencia: d("2026-12-01") },
      ]),
    ).toEqual([
      { mes: "2026-10", valor: "1500.30" },
      { mes: "2026-11", valor: "300.00" },
    ]);
  });
  it("retenção bruta e líquida (aumento conta só na líquida; conta nova não entra)", () => {
    const f = [
      { contaId: "a", referencia: "2026-10", valor: "500" },
      { contaId: "b", referencia: "2026-10", valor: "500" },
      { contaId: "a", referencia: "2026-11", valor: "700" }, // expandiu
      { contaId: "c", referencia: "2026-11", valor: "900" }, // nova
      // b cancelou
    ];
    expect(retencao(f, "2026-10", "2026-11")).toEqual({ bruta: 50, liquida: 70 });
    expect(retencao([], "2026-10", "2026-11")).toEqual({ bruta: null, liquida: null });
  });
  it("mediana do tempo de montagem, em dias", () => {
    expect(medianaDiasMontagem([{ criadoEm: d("2026-10-01"), geradoEm: d("2026-10-03") }, { criadoEm: d("2026-10-01"), geradoEm: d("2026-10-05") }, { criadoEm: d("2026-10-01"), geradoEm: null }])).toBe(3);
    expect(medianaDiasMontagem([])).toBeNull();
  });
  it("painel só para os e-mails configurados", () => {
    vi.stubEnv("PAINEL_EMAILS", "Dono@Exemplo.local, socio@exemplo.local");
    expect(podeVerPainel("dono@exemplo.local")).toBe(true);
    expect(podeVerPainel("cliente@empresa.com.br")).toBe(false);
    vi.stubEnv("PAINEL_EMAILS", "");
    expect(podeVerPainel("dono@exemplo.local")).toBe(false);
  });
});


describe("5.4: custo de aquisição e margem", () => {
  const f = (contaId: string, s: string) => ({ contaId, pagaEm: new Date(`${s}T12:00:00Z`) });
  it("novas pagantes contam pelo primeiro pagamento", () => {
    const fs = [f("a", "2026-09-10"), f("a", "2026-10-10"), f("b", "2026-10-03"), f("c", "2026-10-20"), { contaId: "d", pagaEm: null }];
    expect(novasPagantes(fs, "2026-10")).toBe(2);
    expect(novasPagantes(fs, "2026-09")).toBe(1);
  });
  it("sem número informado, o indicador não aparece", () => {
    expect(custoPorAquisicao(null, 3)).toBeNull();
    expect(custoPorAquisicao("1500", 0)).toBeNull();
    expect(custoPorAquisicao("1500", 3)).toBe("500.00");
    expect(margemEmReais("10000", null)).toBeNull();
    expect(margemEmReais("10000", "62.5")).toBe("6250.00");
  });
});

describe("5.5: tempo humano e Sean Ellis", () => {
  it("minutos por plano e por cliente, só no mês", () => {
    const d = (s: string) => new Date(`${s}T12:00:00Z`);
    const r = tempoPorPlano(
      [
        { contaId: "a", tipo: "COLETA", minutos: 30, data: d("2026-10-02") },
        { contaId: "a", tipo: "SUPORTE", minutos: 10, data: d("2026-10-05") },
        { contaId: "b", tipo: "CALCULO", minutos: 20, data: d("2026-10-09") },
        { contaId: "b", tipo: "CALCULO", minutos: 99, data: d("2026-09-09") },
      ],
      new Map([["a", "CARTEIRA"], ["b", "CARTEIRA"]]),
      "2026-10",
    );
    expect(r).toEqual([{ plano: "CARTEIRA", clientes: 2, minutos: 60, porCliente: 30, porTipo: { COLETA: 30, SUPORTE: 10, CALCULO: 20 } }]);
  });
  it("Sean Ellis: % de muito decepcionados entre quem ainda usa", () => {
    expect(resultadoSeanEllis([{ resposta: "MUITO_DECEPCIONADO" }, { resposta: "MUITO_DECEPCIONADO" }, { resposta: "POUCO_DECEPCIONADO" }, { resposta: "NAO_DECEPCIONADO" }, { resposta: "NAO_USO_MAIS" }])).toEqual({
      respostas: 5,
      consideradas: 4,
      muito: 2,
      pct: 50,
    });
  });
  it("F1: pesquisa só para quem gerou dossiê há 7 dias ou mais, uma vez, fora da demonstração", () => {
    const agora = new Date("2026-11-13T12:00:00Z");
    const conta = { demo: false, pesquisaDispensadaEm: null };
    expect(mostrarPesquisa(conta, null, agora)).toBe(false); // conta antiga que nunca gerou dossiê: antes aparecia
    expect(mostrarPesquisa(conta, new Date("2026-11-10T12:00:00Z"), agora)).toBe(false); // 3 dias
    expect(mostrarPesquisa(conta, new Date("2026-11-06T12:00:00Z"), agora)).toBe(true); // 7 dias
    expect(mostrarPesquisa({ ...conta, pesquisaDispensadaEm: agora }, new Date("2026-10-01T00:00:00Z"), agora)).toBe(false);
    expect(mostrarPesquisa({ ...conta, demo: true }, new Date("2026-10-01T00:00:00Z"), agora)).toBe(false);
  });
});
