import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
const { acaoJornada, jornadaEmSimulacao, jornadaVisivelPara, paginaJornada } = await import("./jornada-acesso");

// D0/D7: a chave mestra vale no servidor (ações e páginas), não só na tela.
describe("D0: acesso à jornada", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("desligada: só PAINEL_EMAILS veem, com a marca; cliente recebe 'não encontrado' e 404", () => {
    vi.stubEnv("JORNADA_REGRA_CONFIRMADA", "false");
    vi.stubEnv("PAINEL_EMAILS", "dono@exemplo.local");
    expect(jornadaVisivelPara("dono@exemplo.local")).toBe(true);
    expect(jornadaVisivelPara("cliente@exemplo.local")).toBe(false);
    expect(jornadaEmSimulacao()).toBe(true);
    expect(() => acaoJornada("cliente@exemplo.local", "JORNADA_EC141")).toThrow(/não encontrado/);
    expect(() => paginaJornada("cliente@exemplo.local", { gatilho: "JORNADA_EC141" })).toThrow("NOT_FOUND");
    expect(() => acaoJornada("cliente@exemplo.local", "NOVA_CONVENCAO")).not.toThrow();
  });
  it("ligada: liberada para todos e a marca some", () => {
    vi.stubEnv("JORNADA_REGRA_CONFIRMADA", "true");
    vi.stubEnv("PAINEL_EMAILS", "");
    expect(jornadaVisivelPara("cliente@exemplo.local")).toBe(true);
    expect(jornadaEmSimulacao()).toBe(false);
    expect(() => acaoJornada("cliente@exemplo.local", "JORNADA_EC141")).not.toThrow();
  });
});
