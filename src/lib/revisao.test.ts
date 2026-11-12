import { afterEach, describe, expect, it, vi } from "vitest";
import { revisaoEspecialistaAtiva } from "./revisao";

describe("L12: revisão de especialista desligada por padrão", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("sem a variável, fica escondida", () => {
    vi.stubEnv("REVISAO_ESPECIALISTA_ATIVA", "");
    expect(revisaoEspecialistaAtiva()).toBe(false);
  });
  it("só liga com true", () => {
    vi.stubEnv("REVISAO_ESPECIALISTA_ATIVA", "true");
    expect(revisaoEspecialistaAtiva()).toBe(true);
  });
});
