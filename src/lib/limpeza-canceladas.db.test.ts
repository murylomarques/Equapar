import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { limparContasCanceladas } from "./limpeza-canceladas";

// C8 (precisa do PostgreSQL: npm run test:db). Cria contas FICTÍCIAS e roda só a SIMULAÇÃO; apaga o que criou.
const ids: string[] = [];
beforeAll(async () => {
  const dia = 86_400_000;
  const mk = async (nome: string, situacao: string, carencia: Date | null) => {
    const c = await db.conta.create({ data: { nome, situacaoCobranca: situacao, carenciaAte: carencia } });
    ids.push(c.id);
    const e = await db.empresa.create({ data: { contaId: c.id, cnpj: `T${Date.now()}${ids.length}`.slice(0, 14), razaoSocial: `${nome} Ltda. (fictícia)` } });
    const k = await db.contrato.create({ data: { empresaId: e.id, numero: "1/2026", orgao: "Órgão Exemplo", objeto: "Limpeza (exemplo)", vigenciaInicio: new Date(), vigenciaFim: new Date(Date.now() + 100 * dia) } });
    await db.documento.create({ data: { contratoId: k.id, tipo: "PLANILHA", nome: "planilha.xlsx", mime: "application/octet-stream", tamanho: 1, caminho: `${c.id}/teste.xlsx` } });
    await db.fatura.create({ data: { contaId: c.id, referencia: "2026-09", descricao: "Plano Carteira (fictício)", valor: "297.00", vencimento: new Date(), status: "FALHOU" } });
  };
  await mk("Cancelada há 40 dias", "SOMENTE_LEITURA", new Date(Date.now() - 40 * dia));
  await mk("Cancelada há 10 dias", "SOMENTE_LEITURA", new Date(Date.now() - 10 * dia));
  await mk("Ativa", "EM_DIA", null);
});
afterAll(async () => {
  await db.conta.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

describe("C8: guarda depois do cancelamento", () => {
  it("só entram documentos de conta cancelada há mais de 30 dias; cobrança e registros ficam", async () => {
    const r = await limparContasCanceladas({ aplicar: false });
    expect(r.modo).toBe("simulacao");
    expect(r.contas).toBeGreaterThanOrEqual(1);
    expect(r.contasAtivasNaLista).toBe(0);
    expect(r.mantidosPorLei).toContain("Fatura (cobrança e nota fiscal)");
    expect(r.faturasMantidas).toBeGreaterThanOrEqual(1); // a fatura da conta cancelada não entra na limpeza
    expect(r.documentos).toBeGreaterThanOrEqual(1);
    // a simulação não apagou nada
    expect(await db.documento.count({ where: { caminho: { in: ids.map((i) => `${i}/teste.xlsx`) } } })).toBe(3);
  });
});
