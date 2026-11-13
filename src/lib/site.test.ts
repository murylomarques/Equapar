import { afterEach, describe, expect, it, vi } from "vitest";
import { camposFaltando, dadoSite } from "./site";

// 5.2: "[PREENCHER]" nunca aparece em produção; o build avisa o que falta.
describe("5.2: dados do site", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("em produção, campo com [PREENCHER] some; preenchido aparece", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(dadoSite("[PREENCHER] (00) 00000-0000")).toBeNull();
    expect(dadoSite("contato@equapar.com.br")).toBe("contato@equapar.com.br");
  });
  it("em desenvolvimento, aparece para lembrar de preencher", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(dadoSite("[PREENCHER] x")).toBe("[PREENCHER] x");
  });
  it("lista os campos que faltam", () => {
    expect(camposFaltando()).toEqual(expect.arrayContaining(["cnpj"]));
  });
});
