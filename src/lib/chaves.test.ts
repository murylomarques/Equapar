import { afterEach, describe, expect, it, vi } from "vitest";
import { GUIAS_NO_AR, guiaNoAr, modoPiloto, rotaEscondida } from "./chaves";
import { GUIAS } from "./guias";

// A6: MODO_PILOTO esconde e devolve as mesmas rotas; nunca apaga (trava 10).
describe("A6: MODO_PILOTO", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("padrão ligado", () => {
    vi.stubEnv("MODO_PILOTO", undefined as never);
    expect(modoPiloto()).toBe(true);
  });
  it("ligado: rotas escondidas (404 no site, Hoje no app); desligado: tudo volta", () => {
    vi.stubEnv("MODO_PILOTO", "true");
    expect(rotaEscondida("/assessorias")).toBe("404");
    expect(rotaEscondida("/app/recuperado")).toBe("hoje");
    expect(rotaEscondida("/app/trocar-conta")).toBe("hoje");
    expect(rotaEscondida("/guias/reforma-tributaria-contratos-publicos-reequilibrio")).toBe("404");
    expect(rotaEscondida("/app/hoje")).toBeNull();
    vi.stubEnv("MODO_PILOTO", "false");
    for (const r of ["/assessorias", "/app/recuperado", "/app/trocar-conta", "/guias/reforma-tributaria-contratos-publicos-reequilibrio"]) expect(rotaEscondida(r)).toBeNull();
  });
  it("os 3 guias do piloto ficam sempre no ar; o da jornada só com a chave da fase D", () => {
    vi.stubEnv("MODO_PILOTO", "true");
    vi.stubEnv("JORNADA_REGRA_CONFIRMADA", "false");
    expect(GUIAS.filter((g) => guiaNoAr(g.slug)).map((g) => g.slug).sort()).toEqual([...GUIAS_NO_AR].sort());
    vi.stubEnv("JORNADA_REGRA_CONFIRMADA", "true");
    expect(guiaNoAr("jornada-40-horas-contratos-publicos")).toBe(true);
  });
});
