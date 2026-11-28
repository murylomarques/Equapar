import { afterEach, describe, expect, it, vi } from "vitest";
import { GUIA_JORNADA, guiaNoAr, modoPiloto, rotaEscondida } from "./chaves";
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
    // guias aprovados não dependem do piloto
    expect(rotaEscondida("/guias/reforma-tributaria-contratos-publicos-reequilibrio")).toBeNull();
    expect(rotaEscondida("/app/hoje")).toBeNull();
    vi.stubEnv("MODO_PILOTO", "false");
    for (const r of ["/assessorias", "/app/recuperado", "/app/trocar-conta"]) expect(rotaEscondida(r)).toBeNull();
  });
  it("guia aprovado fica no ar sempre: no piloto e com o módulo da jornada desligado (só a revisão jurídica decide)", () => {
    vi.stubEnv("MODO_PILOTO", "true");
    vi.stubEnv("JORNADA_REGRA_CONFIRMADA", "false");
    const aprovados = GUIAS.filter((g) => g.revisao !== "pendente").map((g) => g.slug);
    expect(GUIAS.filter((g) => guiaNoAr(g.slug)).map((g) => g.slug).sort()).toEqual(aprovados.sort());
    expect(aprovados).toContain(GUIA_JORNADA);
    expect(aprovados).toContain("reforma-tributaria-contratos-publicos-reequilibrio");
  });
  it("revisão jurídica pendente: nunca no ar (nem fora do piloto); slug desconhecido também não", () => {
    vi.stubEnv("MODO_PILOTO", "false");
    for (const g of GUIAS.filter((x) => x.revisao === "pendente")) expect(guiaNoAr(g.slug)).toBe(false);
    expect(guiaNoAr("nao-existe")).toBe(false);
  });
  it("GUIAS_PREVIA=true mostra os pendentes (só para conferir fora do site público)", () => {
    vi.stubEnv("MODO_PILOTO", "false");
    vi.stubEnv("GUIAS_PREVIA", "true");
    const pendente = GUIAS.find((x) => x.revisao === "pendente" && x.slug !== GUIA_JORNADA);
    if (pendente) expect(guiaNoAr(pendente.slug)).toBe(true);
  });
});
