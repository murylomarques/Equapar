import { beforeEach, describe, expect, it, vi } from "vitest";
import { antes as exemplo } from "../../../../prisma/seed-demo";
import type { PlanilhaCustos } from "@/lib/calculo/tipos";

// 5.5: leitura da convenção com IA. A IA é simulada aqui (sem chave real). A IA só sugere:
// nada muda na planilha até a pessoa marcar a linha; só as marcadas entram, com cláusula e página como fonte.
class Redirect extends Error {}
const updates: Record<string, unknown>[] = [];
let pedido: Record<string, unknown>;
const srv = exemplo.tipos[0];
const piso = srv.linhas.find((l) => l.salarioBase)!;
const vale = srv.linhas.find((l) => l.modulo === "M2_3")!;
vi.mock("next/navigation", () => ({ redirect: () => { throw new Redirect(); }, unstable_rethrow: (e: unknown) => { if (e instanceof Redirect) throw e; } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/eventos", () => ({ registrarEvento: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  exigir: async () => ({ conta: { id: "c1" }, usuario: { nome: "Dono" } }),
  pedidoDaConta: async () => ({ ...pedido }),
  contratoDaConta: vi.fn(),
  registrarHistorico: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({
  salvarArquivo: async () => ({ caminho: "c1/x.pdf", nome: "cct.pdf", mime: "application/pdf", tamanho: 10, buffer: Buffer.from("%PDF") }),
  apagarArquivo: vi.fn(),
  gravarArquivo: vi.fn(),
  lerArquivo: vi.fn(),
}));
vi.mock("@/lib/ia", () => ({
  iaAtiva: () => true,
  lerPlanilhaPdf: vi.fn(),
  lerConvencaoPdf: vi.fn(async () => ({
    observacoes: "",
    sugestoes: [
      { postoId: "srv", linhaId: piso.id, valorNovo: "1.900,00", clausula: "3ª", pagina: 4, trecho: "piso de R$ 1.900,00", confianca: "alta" },
      { postoId: "srv", linhaId: vale.id, valorNovo: "260", clausula: "Cláusula 9ª", pagina: 7, trecho: "vale", confianca: "baixa" },
      { postoId: "srv", linhaId: "nao-existe", valorNovo: "1", clausula: "1ª", pagina: 1, trecho: "", confianca: "alta" },
    ],
  })),
}));
vi.mock("@/lib/db", () => ({
  db: {
    documento: { create: vi.fn(async () => ({ id: "doc1" })), findFirst: vi.fn(async () => null) },
    pedido: { update: vi.fn(async ({ data }) => updates.push(data)) },
  },
}));
const { aplicarSugestoesConvencao, lerConvencaoComIa } = await import("./acoes");
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ pedidoId: "p1", ...o })) f.set(k, v);
  return f;
};

beforeEach(() => {
  updates.length = 0;
  pedido = {
    id: "p1", contratoId: "k1", estado: "EM_ANALISE", passoAtual: 3, gatilho: "NOVA_CONVENCAO", convencaoId: "cv", memoriaAprovadaEm: null,
    dataBase: new Date(Date.UTC(2026, 0, 1)), dataReferencia: null, checklist: null, planilhaAntes: structuredClone(exemplo), planilhaAgora: structuredClone(exemplo), sugestoesConvencao: null,
  };
});

describe("5.5: leitura da convenção com IA", () => {
  it("ler a convenção guarda só sugestões válidas e não mexe na planilha", async () => {
    const f = form({});
    f.set("arquivo", new File(["%PDF"], "cct.pdf", { type: "application/pdf" }));
    const r = (await lerConvencaoComIa({}, f)) as { ok?: string };
    expect(r.ok).toMatch(/2 sugestões/);
    expect(updates[0].planilhaAgora).toBeUndefined();
    const sug = updates[0].sugestoesConvencao as { documentoId: string; itens: { linhaId: string; valorNovo: string }[] };
    expect(sug.documentoId).toBe("doc1");
    expect(sug.itens.map((i) => [i.linhaId, i.valorNovo])).toEqual([
      [piso.id, "1900.00"],
      [vale.id, "260.00"],
    ]);
  });
  it("só a linha marcada entra, com o valor confirmado e a cláusula e a página como fonte", async () => {
    const f = form({});
    f.set("arquivo", new File(["%PDF"], "cct.pdf", { type: "application/pdf" }));
    await lerConvencaoComIa({}, f);
    pedido.sugestoesConvencao = updates[0].sugestoesConvencao;
    updates.length = 0;
    await aplicarSugestoesConvencao({}, form({ [`ok:srv:${piso.id}`]: "on", [`valor:srv:${piso.id}`]: "1.905,50", [`valor:srv:${vale.id}`]: "999" }));
    const nova = updates[0].planilhaAgora as PlanilhaCustos;
    const lp = nova.tipos[0].linhas.find((l) => l.id === piso.id)!;
    const lv = nova.tipos[0].linhas.find((l) => l.id === vale.id)!;
    expect(lp).toMatchObject({ valor: "1905.50", fonte: "Cláusula 3ª, p. 4" });
    expect(lv.valor).toBe(vale.valor); // não marcada: não muda
    const resto = updates[0].sugestoesConvencao as { itens: { linhaId: string }[] };
    expect(resto.itens.map((i) => i.linhaId)).toEqual([vale.id]);
  });
  it("sem nenhuma linha marcada, nada é gravado", async () => {
    pedido.sugestoesConvencao = { documentoId: "doc1", lidoEm: "", observacoes: "", itens: [{ postoId: "srv", posto: "x", linhaId: piso.id, descricao: "", tipo: "VALOR", valorAtual: "1", valorNovo: "2.00", clausula: "1ª", pagina: 1, trecho: "", confianca: "alta" }] };
    const r = (await aplicarSugestoesConvencao({}, form({}))) as { erro?: string };
    expect(r.erro).toMatch(/Marque/);
    expect(updates).toHaveLength(0);
  });
});
