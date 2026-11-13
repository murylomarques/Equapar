import { afterEach, describe, expect, it, vi } from "vitest";
import { medianaDiasMontagem, podeVerPainel, recuperadoNoPrazoPorMes, retencao } from "./metricas";

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
    vi.stubEnv("PAINEL_EMAILS", "Dono@Equapar.com.br, socio@equapar.com.br");
    expect(podeVerPainel("dono@equapar.com.br")).toBe(true);
    expect(podeVerPainel("cliente@empresa.com.br")).toBe(false);
    vi.stubEnv("PAINEL_EMAILS", "");
    expect(podeVerPainel("dono@equapar.com.br")).toBe(false);
  });
});
