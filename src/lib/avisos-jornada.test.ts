import { describe, expect, it, vi } from "vitest";

// 5.1: aviso da jornada vai uma vez por conta, só quando há contrato afetado, e traz a fonte.
const u = { id: "u1", email: "pessoa@exemplo.local", whatsapp: null, whatsappConsentEm: null, prefsAvisos: null, emailVerificadoEm: new Date() };
const conta = { id: "a", demo: false, avisoJornadaEm: null as Date | null, membros: [{ usuario: u }], empresas: [{ exemplo: false }] };
const afetado = { id: "k1", numero: "1/2025", orgao: "Órgão", maoDeObraDedicada: true, arquivado: false, vigenciaFim: new Date("2028-06-30T00:00:00Z"), convencao: null, pedidos: [], tipoReajuste: "REPACTUACAO" };
const enviados: { chave: string; corpo: string }[] = [];
vi.mock("./db", () => ({
  db: {
    conta: {
      findMany: vi.fn(async () => [conta]),
      update: vi.fn(async ({ data }: { data: { avisoJornadaEm: Date } }) => (conta.avisoJornadaEm = data.avisoJornadaEm)),
    },
    contrato: { findMany: vi.fn(async () => [afetado]) },
    pedido: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("./mensagens", () => ({ appUrl: (p = "") => p, enviar: vi.fn(async (e: { chave: string; corpo: string }) => (enviados.push(e), {})) }));
const { rodarAvisos } = await import("./avisos");

describe("5.1: aviso da jornada", () => {
  it("envia uma vez com a fonte e marca a conta; na segunda rodada não repete", async () => {
    const agora = new Date("2026-11-13T15:00:00Z"); // sexta: sem resumo semanal
    await rodarAvisos({ agora });
    const j = enviados.filter((e) => e.chave.startsWith("JORNADA:"));
    expect(j).toHaveLength(1);
    expect(j[0].corpo).toContain("conjur.com.br");
    expect(j[0].corpo).toContain("a confirmar");
    expect(conta.avisoJornadaEm).toEqual(agora);
    await rodarAvisos({ agora });
    expect(enviados.filter((e) => e.chave.startsWith("JORNADA:"))).toHaveLength(1);
  });
});
