import { describe, expect, it, vi } from "vitest";

// S5: "Verificar prazos agora" de uma conta não pode rodar nem contar as outras contas.
const contas = [
  { id: "a", demo: false, membros: [], empresas: [] },
  { id: "b", demo: false, membros: [], empresas: [] },
];
const contratosPedidos: string[] = [];
vi.mock("./db", () => ({
  db: {
    conta: { findMany: vi.fn(async ({ where } = {}) => contas.filter((c) => !where?.id || c.id === where.id)) },
    contrato: { findMany: vi.fn(async ({ where }) => (contratosPedidos.push(where.empresa.contaId), [])) },
    pedido: { findMany: vi.fn(async () => []) },
    usuario: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("./mensagens", () => ({ enviar: vi.fn(), appUrl: (p = "") => p }));
const { rodarAvisos } = await import("./avisos");

describe("S5: avisos de uma conta só", () => {
  it("com contaId, só a conta pedida é verificada", async () => {
    contratosPedidos.length = 0;
    await rodarAvisos({ contaId: "a" });
    expect(contratosPedidos).toEqual(["a"]);
  });
  it("sem contaId (rotina de hora em hora), todas as contas", async () => {
    contratosPedidos.length = 0;
    await rodarAvisos();
    expect(contratosPedidos).toEqual(["a", "b"]);
  });
});
