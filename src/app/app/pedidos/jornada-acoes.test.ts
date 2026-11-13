import { beforeEach, describe, expect, it, vi } from "vitest";
import { antes as exemplo } from "../../../../prisma/seed-demo";
const exemploPlanilha = () => structuredClone(exemplo);

// 5.1: pedido da jornada (EC 141/2026). Passo 1 sem convenção; passo 3 exige escolher o cenário.
class Redirect extends Error {}
const updates: Record<string, unknown>[] = [];
let pedido: Record<string, unknown>;
vi.mock("next/navigation", () => ({ redirect: () => { throw new Redirect(); }, unstable_rethrow: (e: unknown) => { if (e instanceof Redirect) throw e; } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/eventos", () => ({ registrarEvento: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  exigir: async () => ({ conta: { id: "c1" }, usuario: { nome: "Dono" } }),
  pedidoDaConta: async () => ({ ...pedido }),
  contratoDaConta: vi.fn(),
  registrarHistorico: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    convencao: { findFirst: vi.fn(async () => null), update: vi.fn() },
    contrato: { count: vi.fn(async () => 0) },
    pedido: { update: vi.fn(async ({ data }) => updates.push(data)) },
  },
}));
const { salvarPasso1, concluirPasso3 } = await import("./acoes");
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ pedidoId: "p1", ...o })) f.set(k, v);
  return f;
};
const rodar = (a: Promise<unknown>) => a.catch((e) => (e instanceof Redirect ? {} : Promise.reject(e)));

beforeEach(() => {
  updates.length = 0;
  pedido = {
    id: "p1", contratoId: "k1", estado: "EM_ANALISE", passoAtual: 3, gatilho: "JORNADA_EC141", convencaoId: null,
    dataBase: new Date(Date.UTC(2026, 11, 16)), dataDeposito: null, descricaoGatilho: null, dataReferencia: null, memoriaAprovadaEm: null,
    jornadaAntes: 44, jornadaDepois: 40, horasCobertura: "44.00", inicioJornada: new Date(Date.UTC(2026, 11, 16)), cenarioJornada: null,
    retroContarAte: "DATA_INFORMADA", retroMesIncompleto: "DIAS_CORRIDOS", checklist: null,
    planilhaAntes: exemploPlanilha(), planilhaAgora: exemploPlanilha(),
  };
});

describe("5.1 jornada nas ações do pedido", () => {
  it("passo 1 aceita a jornada sem convenção nem depósito e usa o início como data-base", async () => {
    pedido.passoAtual = 1;
    const r = (await rodar(salvarPasso1({}, form({ gatilho: "JORNADA_EC141", jornadaAntes: "44", jornadaDepois: "40", horasCobertura: "44", inicioJornada: "2027-12-16" })))) as { erro?: string };
    expect(r.erro).toBeUndefined();
    expect(updates[0]).toMatchObject({ gatilho: "JORNADA_EC141", convencaoId: null, dataDeposito: null, jornadaDepois: 40, horasCobertura: "44.00" });
    expect((updates[0].dataBase as Date).toISOString().slice(0, 10)).toBe("2027-12-16");
  });
  it("passo 1 recusa nova jornada inválida", async () => {
    pedido.passoAtual = 1;
    const r = (await rodar(salvarPasso1({}, form({ gatilho: "JORNADA_EC141", jornadaAntes: "44", jornadaDepois: "44", horasCobertura: "44", inicioJornada: "2027-12-16" })))) as { campos?: Record<string, string> };
    expect(r.campos?.jornadaDepois).toBeTruthy();
    expect(updates).toHaveLength(0);
  });
  it("passo 3 sem cenário: recusa, nada é gravado", async () => {
    const r = (await rodar(concluirPasso3({}, form({ dataReferencia: "2027-01-31" })))) as { erro?: string };
    expect(r.erro).toMatch(/cenário/);
    expect(updates).toHaveLength(0);
  });
  it("passo 3 manter horas: planilha nova × 44/40 e diferença positiva", async () => {
    await rodar(concluirPasso3({}, form({ dataReferencia: "2027-01-31", cenarioJornada: "MANTER_HORAS" })));
    expect(updates[0].cenarioJornada).toBe("MANTER_HORAS");
    expect(Number(updates[0].diferencaMensal)).toBeGreaterThan(0);
  });
  it("passo 3 reduzir horas: diferença zero é aceita", async () => {
    await rodar(concluirPasso3({}, form({ dataReferencia: "2027-01-31", cenarioJornada: "REDUZIR_HORAS" })));
    expect(updates[0].cenarioJornada).toBe("REDUZIR_HORAS");
    expect(Number(updates[0].diferencaMensal)).toBe(0);
  });
});
