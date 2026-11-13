import { afterEach, describe, expect, it, vi } from "vitest";
import { subprocessadores } from "./subprocessadores";

// C8: só os subprocessadores ligados; a Anthropic só com uma chave de IA ligada, marcada como internacional.
describe("C8: subprocessadores lidos do ambiente", () => {
  afterEach(() => vi.unstubAllEnvs());
  const limpar = () => {
    for (const k of ["HOSPEDAGEM_PROVEDOR", "ARMAZENAMENTO", "S3_ENDPOINT", "SMTP_URL", "TURNSTILE_SECRET_KEY", "GOOGLE_CLIENT_ID", "ASAAS_API_KEY", "WHATSAPP_TOKEN", "ANTHROPIC_API_KEY", "IA_LEITURA_PLANILHA", "IA_LEITURA_CONVENCAO"]) vi.stubEnv(k, "");
  };
  it("sem integrações: só a hospedagem", () => {
    limpar();
    expect(subprocessadores().map((s) => s.papel)).toEqual(["Hospedagem do sistema e do banco de dados"]);
  });
  it("Anthropic só com chave da API e uma chave de IA ligada", () => {
    limpar();
    vi.stubEnv("ANTHROPIC_API_KEY", "chave-ficticia");
    expect(subprocessadores().some((s) => s.quem === "Anthropic")).toBe(false);
    vi.stubEnv("IA_LEITURA_CONVENCAO", "true");
    expect(subprocessadores().find((s) => s.quem === "Anthropic")?.internacional).toBe(true);
  });
  it("e-mail e armazenamento pelo host configurado", () => {
    limpar();
    vi.stubEnv("SMTP_URL", "smtps://usuario:senha@smtp.exemplo.local:465");
    vi.stubEnv("ARMAZENAMENTO", "s3");
    vi.stubEnv("S3_ENDPOINT", "https://s3.exemplo.local");
    const q = subprocessadores().map((s) => s.quem);
    expect(q).toContain("smtp.exemplo.local");
    expect(q).toContain("s3.exemplo.local");
    expect(JSON.stringify(subprocessadores())).not.toContain("senha");
  });
});
