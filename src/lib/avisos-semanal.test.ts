import { describe, expect, it, vi } from "vitest";

// L9: o resumo semanal vai por usuário + conta + semana; contas de exemplo e de demonstração nunca enviam.
const u = { id: "u1", email: "pessoa@exemplo.local", whatsapp: null, whatsappConsentEm: null, prefsAvisos: null, emailVerificadoEm: new Date() };
const contas = [
  { id: "a", demo: false, membros: [{ usuario: u }], empresas: [{ exemplo: false }] },
  { id: "b", demo: false, membros: [{ usuario: u }], empresas: [{ exemplo: false }] },
  { id: "x", demo: false, membros: [{ usuario: u }], empresas: [{ exemplo: true }] },
];
const chaves: string[] = [];
vi.mock("./db", () => ({
  db: {
    conta: { findMany: vi.fn(async () => contas) },
    contrato: { findMany: vi.fn(async () => []) },
    pedido: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("./mensagens", () => ({ appUrl: (p = "") => p, enviar: vi.fn(async (e: { chave: string; contaId: string }) => (chaves.push(`${e.contaId}|${e.chave}`), {})) }));
const { rodarAvisos } = await import("./avisos");

describe("L9: resumo semanal", () => {
  it("quem está em duas contas recebe um resumo de cada; a conta de exemplo não envia", async () => {
    await rodarAvisos({ agora: new Date("2026-11-16T15:00:00Z") }); // segunda-feira, 12h em Brasília
    const semanais = chaves.filter((c) => c.includes("SEMANAL"));
    expect(semanais.map((c) => c.split("|")[0]).sort()).toEqual(["a", "b"]);
    expect(new Set(semanais.map((c) => c.split("|")[1])).size).toBe(2);
  });
});
