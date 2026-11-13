import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ db: {} }));
const { enviarEmailDeTeste } = await import("./mensagens");

// G6: o botão "Enviar e-mail de teste" mostra o erro exato, sem a senha da SMTP_URL.
describe("G6: e-mail de teste", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("sem PAINEL_EMAILS ou sem SMTP_URL, explica o que falta", async () => {
    vi.stubEnv("PAINEL_EMAILS", "");
    expect(await enviarEmailDeTeste()).toEqual({ ok: false, erro: "PAINEL_EMAILS está vazia: não há para quem enviar." });
    vi.stubEnv("PAINEL_EMAILS", "dono@exemplo.local");
    vi.stubEnv("SMTP_URL", "");
    expect(await enviarEmailDeTeste()).toEqual({ ok: false, erro: "SMTP_URL está vazia: o e-mail está em simulação." });
  });
  it("servidor fora do ar: devolve o erro exato e nunca a senha", async () => {
    vi.stubEnv("PAINEL_EMAILS", "dono@exemplo.local");
    vi.stubEnv("SMTP_URL", "smtp://usuario:senha-secreta@127.0.0.1:1");
    const r = await enviarEmailDeTeste();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro).toMatch(/ECONNREFUSED|ESOCKET|ECONNECTION/);
      expect(r.erro).not.toContain("senha-secreta");
    }
  });
});
