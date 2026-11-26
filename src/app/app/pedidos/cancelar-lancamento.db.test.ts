import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

// Cancelar nota fiscal ou recebimento (precisa do PostgreSQL: npm run test:db). Cria uma conta FICTÍCIA e apaga no fim.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/eventos", () => ({ registrarEvento: vi.fn() }));
const papel = { atual: "GERENTE" as "GERENTE" | "CONTADOR" };
let contaId = "";
vi.mock("@/lib/auth", async () => {
  const { ErroUsuario } = await import("@/lib/acao");
  const { db } = await import("@/lib/db");
  const { pode } = await import("@/lib/auth-papeis");
  return {
    exigir: async (acao: string) => {
      if (!pode(papel.atual, acao as never)) throw new ErroUsuario("Seu papel nesta conta não permite esta ação.");
      return { conta: { id: contaId }, usuario: { id: null, nome: "Gerente (fictício)" }, papel: papel.atual };
    },
    pedidoDaConta: async (_ctx: unknown, id: string) => db.pedido.findFirstOrThrow({ where: { id, contrato: { empresa: { contaId } } }, include: { contrato: true } }),
    contratoDaConta: vi.fn(),
    registrarHistorico: async (_ctx: unknown, acao: string, extra: { pedidoId?: string; contratoId?: string; detalhe?: string } = {}) =>
      db.historico.create({ data: { contaId, acao, ...extra } }),
  };
});
const { cancelarLancamento, gerarCobranca } = await import("./acoes");

let pedidoId = "";
let notaId = "";
let baixaId = "";
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

beforeAll(async () => {
  const c = await db.conta.create({ data: { nome: "Cancelamento (fictícia)" } });
  contaId = c.id;
  const e = await db.empresa.create({ data: { contaId, cnpj: `T${Date.now()}`.slice(0, 14), razaoSocial: "Exemplo Serviços Ltda. (fictícia)" } });
  const k = await db.contrato.create({ data: { empresaId: e.id, numero: "9/2026", orgao: "Órgão Exemplo", objeto: "Limpeza (exemplo)", vigenciaInicio: dia("2026-01-01"), vigenciaFim: dia("2027-12-31") } });
  const p = await db.pedido.create({
    data: { contratoId: k.id, estado: "RECEBIDO", deferidoEm: dia("2026-08-01"), apostiladoEm: dia("2026-08-15"), retroativoAprovado: "1000.00", faturadoEm: dia("2026-09-01"), notaFiscal: "55", recebidoEm: dia("2026-10-01"), valorRecebido: "1000.00" },
  });
  pedidoId = p.id;
  const n = await db.notaFiscalPedido.create({ data: { pedidoId, identificacao: "55", emitidaEm: dia("2026-09-01"), valor: "1000.00", referenciaOperacao: "ref-nf-55" } });
  notaId = n.id;
  const b = await db.baixaPedido.create({ data: { pedidoId, notaFiscalId: notaId, recebidoEm: dia("2026-10-01"), valor: "1000.00", referenciaOperacao: "ref-baixa-1" } });
  baixaId = b.id;
});

afterAll(async () => {
  if (contaId) {
    await db.baixaPedido.deleteMany({ where: { pedidoId } });
    await db.conta.delete({ where: { id: contaId } });
  }
  await db.$disconnect();
});

describe("cancelar lançamento financeiro", () => {
  it("Contador não cancela (mesma permissão de registrar o financeiro)", async () => {
    papel.atual = "CONTADOR";
    const r = await cancelarLancamento({}, form({ pedidoId, tipo: "baixa", lancamentoId: baixaId, motivo: "valor errado" }));
    expect(r.erro).toMatch(/papel/);
    papel.atual = "GERENTE";
  });

  it("exige o motivo", async () => {
    const r = await cancelarLancamento({}, form({ pedidoId, tipo: "baixa", lancamentoId: baixaId, motivo: "" }));
    expect(r.erro).toMatch(/motivo/);
  });

  it("a nota com recebimento não cancela antes do recebimento", async () => {
    const r = await cancelarLancamento({}, form({ pedidoId, tipo: "nota", lancamentoId: notaId, motivo: "nota errada" }));
    expect(r.erro).toMatch(/Cancele antes os recebimentos/);
  });

  it("cancelar o recebimento volta o pedido para faturado, limpa o recebido e registra no histórico", async () => {
    const r = await cancelarLancamento({}, form({ pedidoId, tipo: "baixa", lancamentoId: baixaId, motivo: "baixa lançada em duplicidade" }));
    expect(r.ok).toMatch(/cancelado/);
    const p = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } });
    expect(p.estado).toBe("FATURADO");
    expect(p.valorRecebido).toBeNull();
    expect(p.recebidoEm).toBeNull();
    expect((await db.baixaPedido.findUniqueOrThrow({ where: { id: baixaId } })).canceladaEm).not.toBeNull();
    const h = await db.historico.findFirstOrThrow({ where: { pedidoId, acao: { startsWith: "Cancelou o recebimento" } } });
    expect(h.detalhe).toContain("baixa lançada em duplicidade");
  });

  it("cancelar a nota volta para deferido e o mesmo número pode ser lançado de novo", async () => {
    const r = await cancelarLancamento({}, form({ pedidoId, tipo: "nota", lancamentoId: notaId, motivo: "valor digitado errado" }));
    expect(r.ok).toMatch(/Valor deferido/);
    const p = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } });
    expect(p.estado).toBe("DEFERIDO");
    expect(p.faturadoEm).toBeNull();
    const nova = await gerarCobranca({}, form({ pedidoId, notaFiscal: "55", faturadoEm: "2026-09-02", valorNota: "1000,00", referenciaOperacao: "ref-nf-55" }));
    expect(nova.ok).toBe("Nota fiscal registrada.");
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("FATURADO");
  });

  it("lançamento já cancelado não cancela de novo", async () => {
    const r = await cancelarLancamento({}, form({ pedidoId, tipo: "baixa", lancamentoId: baixaId, motivo: "de novo" }));
    expect(r.erro).toMatch(/já foi cancelado/);
  });
});
