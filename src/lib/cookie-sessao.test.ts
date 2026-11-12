import { afterEach, describe, expect, it, vi } from "vitest";
import { opcoesCookieSessao } from "./cookie-sessao";

describe("S8: cookie de sessão", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("produção em HTTPS: prefixo __Host-, Secure, path / e sem Domain", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://app.equapar.com.br");
    expect(opcoesCookieSessao()).toEqual({ nome: "__Host-eq_sessao", secure: true });
  });
  it("desenvolvimento ou HTTP local: nome simples (o navegador recusaria __Host- sem HTTPS)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect(opcoesCookieSessao()).toEqual({ nome: "eq_sessao", secure: false });
  });
});
