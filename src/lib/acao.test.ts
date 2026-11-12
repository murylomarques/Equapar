import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ErroUsuario, tentar } from "./acao";

describe("S9: mensagens de erro", () => {
  it("erro técnico não chega à tela: mensagem clara com código, detalhe só no servidor", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await tentar(async () => {
      throw new Error("TypeError: Cannot read properties of undefined (reading 'tipos') at /srv/app/x.js:10");
    });
    expect(r.erro).toMatch(/^Não deu para concluir\. Tente de novo; se continuar, fale com o suporte \(código do erro: [A-Z0-9]{8}\)\.$/);
    const codigo = r.erro!.match(/código do erro: (\w+)/)![1];
    expect(String(log.mock.calls[0][0])).toContain(codigo);
    log.mockRestore();
  });
  it("mensagem pensada para a pessoa continua chegando", async () => {
    const r = await tentar(async () => {
      throw new ErroUsuario("Seu papel nesta conta não permite esta ação.");
    });
    expect(r.erro).toBe("Seu papel nesta conta não permite esta ação.");
  });
  it("erro de validação (zod) vira mensagem clara, sem o JSON do zod", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await tentar(async () => {
      z.object({ quantidade: z.number() }).parse({ quantidade: "x" });
    });
    expect(r.erro).toMatch(/^Algum dado veio num formato que não esperávamos/);
    expect(r.erro).not.toContain("expected");
  });
});
