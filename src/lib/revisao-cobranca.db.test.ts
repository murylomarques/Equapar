import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { abrirCobrancaDoPlano, cancelarRenovacao, faturasParaRevisar, processarEventoPagamento, resolverRevisao } from "./cobranca-servidor";

// Integração (npm run test:db): fatura marcada para revisão avisa a equipe e aparece no painel interno até ser resolvida.
process.env.ASAAS_API_KEY = "";
process.env.SMTP_URL = "";
const sufixo = Date.now();
const email = `revisao-${sufixo}@exemplo.local`;
const equipe = `equipe-${sufixo}@exemplo.local`;
process.env.PAINEL_EMAILS = equipe;
let contaId = "";

beforeAll(async () => {
  const u = await db.usuario.create({
    data: { nome: "Dono (fictício)", email, membros: { create: { papel: "DONO", conta: { create: { nome: "Conta de teste da revisão (fictícia)", empresas: { create: { cnpj: "11222333000181", razaoSocial: "Empresa Teste (fictícia)" } } } } } } },
    include: { membros: true },
  });
  contaId = u.membros[0].contaId;
});
afterAll(async () => {
  await db.conta.deleteMany({ where: { id: contaId } });
  await db.usuario.deleteMany({ where: { email } });
  await db.aviso.deleteMany({ where: { destino: { in: [email, equipe] } } });
  await db.$disconnect();
});

describe("fatura para revisar: aviso à equipe e lista do painel interno", () => {
  it("pago depois do cancelamento: e-mail para PAINEL_EMAILS (fora da central do cliente), listado até ser resolvido", async () => {
    const r = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "MENSAL", "PIX", email);
    await cancelarRenovacao(contaId);
    expect(await processarEventoPagamento({ faturaId: r.faturaId, evento: "PAGO", eventoId: `evt-rev-${r.faturaId}` })).toBe("processado");
    expect(await db.fatura.findUnique({ where: { id: r.faturaId } })).toMatchObject({ revisao: "PAGA_APOS_CANCELAMENTO", revisaoResolvidaEm: null });

    const avisos = await db.aviso.findMany({ where: { destino: equipe } });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ contaId: null, tipo: "REVISAO_COBRANCA", canal: "EMAIL" });
    expect(avisos[0].corpo).toContain("Devolver o valor");
    expect(avisos[0].corpo).toContain("Conta de teste da revisão (fictícia)");
    // nada na central de avisos do cliente
    expect(await db.aviso.count({ where: { contaId, tipo: "REVISAO_COBRANCA" } })).toBe(0);

    expect((await faturasParaRevisar()).map((f) => f.id)).toContain(r.faturaId);
    expect(await resolverRevisao(r.faturaId, "Dono (fictício)")).toBe(true);
    expect(await resolverRevisao(r.faturaId, "Dono (fictício)")).toBe(false);
    expect((await faturasParaRevisar()).map((f) => f.id)).not.toContain(r.faturaId);
    // a marca continua (ela tira o período do direito de acesso)
    expect(await db.fatura.findUnique({ where: { id: r.faturaId } })).toMatchObject({ revisao: "PAGA_APOS_CANCELAMENTO", revisaoResolvidaPor: "Dono (fictício)" });
    expect((await db.conta.findUniqueOrThrow({ where: { id: contaId } })).plano).toBe("GRATIS");
  });

  it("evento repetido não manda outro e-mail", async () => {
    const f = await db.fatura.findFirstOrThrow({ where: { contaId, revisao: "PAGA_APOS_CANCELAMENTO" } });
    expect(await processarEventoPagamento({ faturaId: f.id, evento: "PAGO", eventoId: `evt-rev-${f.id}` })).toBe("repetido");
    expect(await db.aviso.count({ where: { destino: equipe } })).toBe(1);
  });
});
