import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { antes as exemplo } from "../../../../prisma/seed-demo";
const exemploPlanilha = () => structuredClone(exemplo);

// 5.1: pedido da jornada (EC 141/2026). Passo 1 sem convenção; passo 3 exige escolher o cenário.
class Redirect extends Error {}
const updates: Record<string, unknown>[] = [];
let pedido: Record<string, unknown>;
vi.mock("next/navigation", () => ({ redirect: () => { throw new Redirect(); }, unstable_rethrow: (e: unknown) => { if (e instanceof Redirect) throw e; } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/eventos", () => ({ registrarEvento: vi.fn() }));
let email = "dono@exemplo.local";
vi.mock("@/lib/auth", () => ({
  exigir: async () => ({ conta: { id: "c1" }, usuario: { nome: "Dono", email } }),
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

afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  updates.length = 0;
  email = "dono@exemplo.local";
  // D0: a jornada só funciona para PAINEL_EMAILS (chave desligada) ou para todos (chave ligada)
  vi.stubEnv("PAINEL_EMAILS", "dono@exemplo.local");
  vi.stubEnv("JORNADA_REGRA_CONFIRMADA", "false");
  vi.stubEnv("JORNADA_42H_INICIO", "2026-12-16");
  vi.stubEnv("JORNADA_40H_INICIO", "2027-12-16");
  pedido = {
    id: "p1", contratoId: "k1", estado: "EM_ANALISE", passoAtual: 3, gatilho: "JORNADA_EC141", convencaoId: null,
    dataBase: new Date(Date.UTC(2026, 11, 16)), dataDeposito: null, descricaoGatilho: null, dataReferencia: null, memoriaAprovadaEm: null,
    jornadaAntes: 44, jornadaDepois: 40, horasCobertura: "44.00", inicioJornada: new Date(Date.UTC(2026, 11, 16)), cenarioJornada: null, jornadaEnquadramento: "VIGENTE_NA_EC",
    retroContarAte: "DATA_INFORMADA", retroMesIncompleto: "DIAS_CORRIDOS", checklist: null,
    planilhaAntes: exemploPlanilha(), planilhaAgora: exemploPlanilha(),
  };
});

describe("5.1 jornada nas ações do pedido", () => {
  it("passo 1 aceita a jornada sem convenção nem depósito; a etapa define as horas e o início", async () => {
    pedido.passoAtual = 1;
    const r = (await rodar(salvarPasso1({}, form({ gatilho: "JORNADA_EC141", jornadaEnquadramento: "VIGENTE_NA_EC", etapa: "42-40", horasCobertura: "44" })))) as { erro?: string };
    expect(r.erro).toBeUndefined();
    expect(updates[0]).toMatchObject({ gatilho: "JORNADA_EC141", convencaoId: null, dataDeposito: null, jornadaAntes: 42, jornadaDepois: 40, horasCobertura: "44.00" });
    expect((updates[0].dataBase as Date).toISOString().slice(0, 10)).toBe("2027-12-16");
    // D4: sem data informada, os efeitos financeiros começam no início da etapa
    expect((updates[0].jornadaInicioEfeitos as Date).toISOString().slice(0, 10)).toBe("2027-12-16");
  });
  it("D3: passo 1 recusa sem etapa e recusa efeitos fora da etapa (44 → 40 num só aditivo não existe)", async () => {
    pedido.passoAtual = 1;
    let r = (await rodar(salvarPasso1({}, form({ gatilho: "JORNADA_EC141", horasCobertura: "44" })))) as { campos?: Record<string, string> };
    expect(r.campos?.etapa).toBeTruthy();
    r = (await rodar(salvarPasso1({}, form({ gatilho: "JORNADA_EC141", jornadaEnquadramento: "VIGENTE_NA_EC", etapa: "44-42", horasCobertura: "44", jornadaInicioEfeitos: "2027-12-20" })))) as { campos?: Record<string, string> };
    expect(r.campos?.jornadaInicioEfeitos).toMatch(/16\/12\/2026/);
    expect(updates).toHaveLength(0);
  });
  it("D4: efeitos financeiros informados ficam gravados e a data do aditivo também", async () => {
    pedido.passoAtual = 1;
    await rodar(salvarPasso1({}, form({ gatilho: "JORNADA_EC141", jornadaEnquadramento: "VIGENTE_NA_EC", etapa: "44-42", horasCobertura: "44", jornadaInicioEfeitos: "2027-01-10", jornadaDataAditivo: "2027-02-01" })));
    expect((updates[0].jornadaInicioEfeitos as Date).toISOString().slice(0, 10)).toBe("2027-01-10");
    expect((updates[0].jornadaDataAditivo as Date).toISOString().slice(0, 10)).toBe("2027-02-01");
  });
  it("D7: com a chave desligada, um cliente comum não usa a jornada (permissão no servidor)", async () => {
    email = "cliente@exemplo.local";
    pedido.passoAtual = 1;
    const r = (await rodar(salvarPasso1({}, form({ gatilho: "JORNADA_EC141", jornadaEnquadramento: "VIGENTE_NA_EC", etapa: "44-42", horasCobertura: "44" })))) as { erro?: string };
    expect(r.erro).toMatch(/não encontrado/);
    expect(updates).toHaveLength(0);
    // com a chave ligada, libera para todos
    vi.stubEnv("JORNADA_REGRA_CONFIRMADA", "true");
    const ok = (await rodar(salvarPasso1({}, form({ gatilho: "JORNADA_EC141", jornadaEnquadramento: "VIGENTE_NA_EC", etapa: "44-42", horasCobertura: "44" })))) as { erro?: string };
    expect(ok.erro).toBeUndefined();
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
  it("passo 3 reorganizar as escalas: sem o dimensionamento de cada posto, recusa; com ele, grava os dados do posto", async () => {
    let r = (await rodar(concluirPasso3({}, form({ dataReferencia: "2027-01-31", cenarioJornada: "REORGANIZAR_ESCALAS" })))) as { erro?: string };
    expect(r.erro).toMatch(/empregados por posto/);
    const campos: Record<string, string> = { dataReferencia: "2027-01-31", cenarioJornada: "REORGANIZAR_ESCALAS", jornadaPostosEditado: "1" };
    for (const { id } of (pedido.planilhaAntes as { tipos: { id: string }[] }).tipos)
      Object.assign(campos, { [`j:${id}:semanal`]: "44", [`j:${id}:empregadosAntes`]: "10", [`j:${id}:empregadosDepois`]: "11" });
    r = (await rodar(concluirPasso3({}, form(campos)))) as { erro?: string };
    expect(r.erro).toBeUndefined();
    expect(updates[0].metodologiaVersao).toBe("jornada-2026-11-28");
    expect((updates[0].planilhaAntes as { tipos: { jornada: object }[] }).tipos[0].jornada).toMatchObject({ semanal: 44, empregadosAntes: 10, empregadosDepois: 11 });
  });
});
