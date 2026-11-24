import { afterEach, describe, expect, it, vi } from "vitest";
import { bloqueioPrevio, configIa, custoUsd, piorCustoUsd } from "./ia-orcamento";

afterEach(() => vi.unstubAllEnvs());

describe("P0: custo da IA pelos preços publicados", () => {
  it("Opus 5.5: US$ 4 por milhão de entrada e US$ 20 de saída", () => {
    expect(custoUsd("claude-opus-5-5", { entrada: 1_000_000, saida: 0 }).toString()).toBe("4");
    expect(custoUsd("claude-opus-5-5", { entrada: 30_000, saida: 4_000 }).toFixed(4)).toBe("0.2000");
  });
  it("cache: leitura a 0,05× e escrita a 1,25× no Opus 5.5", () => {
    expect(custoUsd("claude-opus-5-5", { entrada: 0, saida: 0, cacheLeitura: 1_000_000 }).toString()).toBe("0.2");
    expect(custoUsd("claude-opus-5-5", { entrada: 0, saida: 0, cacheEscrita: 1_000_000 }).toString()).toBe("5");
  });
  it("Haiku 5.5 cobra mais acima de 100 mil tokens de entrada", () => {
    expect(custoUsd("claude-haiku-5-5", { entrada: 100_000, saida: 0 }).toString()).toBe("0.01");
    expect(custoUsd("claude-haiku-5-5", { entrada: 100_001, saida: 0 }).toFixed(5)).toBe("0.05000");
  });
  it("modelo sem preço cadastrado não roda", () => {
    expect(() => custoUsd("modelo-desconhecido", { entrada: 1, saida: 1 })).toThrow(/sem preço/);
  });
  it("pior caso: todas as páginas no teto, saída máxima e margem", () => {
    // 10 páginas × 4000 + 500 extras + 2000 = 42.500 de entrada; 16.000 de saída; × 1,2
    const v = piorCustoUsd("claude-opus-5-5", { paginas: 10, tokensExtras: 500 });
    expect(v.toFixed(4)).toBe(((42_500 * 4 + 16_000 * 20) / 1e6 * 1.2).toFixed(4));
  });
});

describe("P0: bloqueios antes de qualquer gasto", () => {
  it("padrão: orçamento zero, ninguém usa (nem plano pago)", () => {
    expect(configIa().globalUsdMes).toBe(0);
    expect(bloqueioPrevio({ plano: "CARTEIRA", bytes: 1000, paginas: 1 })?.codigo).toBe("SEM_ORCAMENTO");
  });
  it("Grátis nunca usa IA paga, mesmo com orçamento configurado", () => {
    vi.stubEnv("IA_ORCAMENTO_GLOBAL_USD_MES", "100");
    vi.stubEnv("IA_ORCAMENTO_CARTEIRA_USD_MES", "5");
    expect(bloqueioPrevio({ plano: "GRATIS", bytes: 1000, paginas: 1 })?.codigo).toBe("PLANO");
    expect(bloqueioPrevio({ plano: "CARTEIRA", bytes: 1000, paginas: 1 })).toBeNull();
  });
  it("desligamento de emergência vale para todos", () => {
    vi.stubEnv("IA_ORCAMENTO_GLOBAL_USD_MES", "100");
    vi.stubEnv("IA_ORCAMENTO_CARTEIRA_USD_MES", "5");
    vi.stubEnv("IA_DESLIGADA", "true");
    expect(bloqueioPrevio({ plano: "CARTEIRA", bytes: 1000, paginas: 1 })?.codigo).toBe("DESLIGADA");
  });
  it("documento grande demais é recusado antes de chamar", () => {
    vi.stubEnv("IA_ORCAMENTO_GLOBAL_USD_MES", "100");
    vi.stubEnv("IA_ORCAMENTO_CARTEIRA_USD_MES", "5");
    expect(bloqueioPrevio({ plano: "CARTEIRA", bytes: 11 * 1024 * 1024, paginas: 1 })?.codigo).toBe("GRANDE_DEMAIS");
    expect(bloqueioPrevio({ plano: "CARTEIRA", bytes: 1000, paginas: 41 })?.codigo).toBe("GRANDE_DEMAIS");
  });
});
