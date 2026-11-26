import { beforeAll, describe, expect, it } from "vitest";
import { linkAindaValido, lerTokenConferencia, situacaoConferencia, tokenConferencia, VALIDADE_CONFERENCIA_MS } from "./conferencia";
import { assinar } from "./cripto";

beforeAll(() => {
  process.env.APP_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres";
});

const agora = Date.UTC(2026, 10, 26, 12);

describe("link de conferência para o contador", () => {
  it("assina e lê pedido, conta, emissão e vencimento em 14 dias", () => {
    const t = tokenConferencia("ped1", "conta1", agora);
    expect(t).toMatch(/^[\w-]+$/); // cabe na URL sem escapar
    expect(lerTokenConferencia(t)).toEqual({ pedidoId: "ped1", contaId: "conta1", emitidoEm: agora, vence: agora + VALIDADE_CONFERENCIA_MS });
    expect(situacaoConferencia(lerTokenConferencia(t), null, agora + 1000)).toBe("ok");
  });

  it("recusa token alterado, de outro tipo ou lixo", () => {
    const t = tokenConferencia("ped1", "conta1", agora);
    const bruto = Buffer.from(t, "base64url").toString("utf8");
    const trocado = Buffer.from(bruto.replace("ped1", "ped2")).toString("base64url");
    expect(lerTokenConferencia(trocado)).toBeNull();
    const outroTipo = Buffer.from(assinar(`convite|ped1|conta1|${agora}|${agora + 1}`)).toString("base64url");
    expect(lerTokenConferencia(outroTipo)).toBeNull();
    expect(lerTokenConferencia("")).toBeNull();
    expect(lerTokenConferencia("abc.def")).toBeNull();
    expect(situacaoConferencia(null, null, agora)).toBe("invalido");
  });

  it("vence depois de 14 dias", () => {
    const t = lerTokenConferencia(tokenConferencia("ped1", "conta1", agora));
    expect(situacaoConferencia(t, null, agora + VALIDADE_CONFERENCIA_MS)).toBe("ok");
    expect(situacaoConferencia(t, null, agora + VALIDADE_CONFERENCIA_MS + 1)).toBe("vencido");
    expect(linkAindaValido(new Date(agora), agora + VALIDADE_CONFERENCIA_MS - 1)).toBe(true);
    expect(linkAindaValido(new Date(agora), agora + VALIDADE_CONFERENCIA_MS)).toBe(false);
  });

  it("revogar desativa os links emitidos até a revogação; um link novo volta a valer", () => {
    const antigo = lerTokenConferencia(tokenConferencia("ped1", "conta1", agora));
    const revogadoEm = new Date(agora + 60_000);
    expect(situacaoConferencia(antigo, revogadoEm, agora + 120_000)).toBe("revogado");
    const novo = lerTokenConferencia(tokenConferencia("ped1", "conta1", agora + 120_000));
    expect(situacaoConferencia(novo, revogadoEm, agora + 180_000)).toBe("ok");
  });
});
