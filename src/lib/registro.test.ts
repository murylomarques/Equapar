import { afterEach, describe, expect, it, vi } from "vitest";
import { registrar, reportarErro } from "./registro";

describe("4.1.5: logs estruturados e alerta de erro", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it("log em uma linha JSON, com nível, evento e id da requisição", () => {
    const saida = vi.spyOn(console, "log").mockImplementation(() => {});
    registrar("info", "pedido_gerado", { pedidoId: "p1" }, "req-123");
    const linha = JSON.parse(String(saida.mock.calls[0][0]));
    expect(linha).toMatchObject({ nivel: "info", evento: "pedido_gerado", pedidoId: "p1", requisicao: "req-123" });
    expect(linha.quando).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it("sem ERROS_WEBHOOK_URL, o alerta de erro fica em simulação (só log, nada sai)", async () => {
    vi.stubEnv("ERROS_WEBHOOK_URL", "");
    const rede = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await reportarErro(new Error("falhou"), { codigo: "ABC12345" });
    expect(r).toBe("simulado");
    expect(rede).not.toHaveBeenCalled();
  });
  it("com ERROS_WEBHOOK_URL, envia o erro (sem dado pessoal: só mensagem, pilha e códigos)", async () => {
    vi.stubEnv("ERROS_WEBHOOK_URL", "https://alertas.exemplo/gancho");
    const rede = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await reportarErro(new Error("falhou"), { codigo: "ABC12345", requisicao: "req-9" })).toBe("enviado");
    const corpo = JSON.parse(String((rede.mock.calls[0][1] as RequestInit).body));
    expect(corpo).toMatchObject({ mensagem: "falhou", codigo: "ABC12345", requisicao: "req-9" });
  });
});
