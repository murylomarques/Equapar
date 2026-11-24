import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { abrirCobrancaDoPlano, processarEventoPagamento } from "./cobranca-servidor";

// Integração (npm run test:db): ciclo completo da cobrança em modo simulação, com uma conta fictícia temporária.
process.env.ASAAS_API_KEY = "";
const email = `cobranca-${Date.now()}@exemplo.local`;
let contaId = "";

beforeAll(async () => {
  const u = await db.usuario.create({
    data: { nome: "Dono (fictício)", email, membros: { create: { papel: "DONO", conta: { create: { nome: "Conta de teste da cobrança (fictícia)", empresas: { create: { cnpj: "11222333000181", razaoSocial: "Empresa Teste (fictícia)" } } } } } } },
    include: { membros: true },
  });
  contaId = u.membros[0].contaId;
});
afterAll(async () => {
  await db.conta.deleteMany({ where: { id: contaId } });
  await db.usuario.deleteMany({ where: { email } });
  await db.aviso.deleteMany({ where: { destino: email } });
  await db.$disconnect();
});

describe("4.2: ciclo da cobrança (simulação)", () => {
  it("escolher o plano abre a cobrança; o plano só muda com o pagamento; evento repetido não conta duas vezes", async () => {
    const r = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "MENSAL", "PIX", email);
    expect(r).toMatchObject({ modo: "simulacao", valor: "297.00" });
    let conta = await db.conta.findUniqueOrThrow({ where: { id: contaId } });
    expect(conta).toMatchObject({ plano: "GRATIS", planoPendente: "CARTEIRA" });
    expect(await processarEventoPagamento({ faturaId: r.faturaId, evento: "PAGO", eventoId: `evt-${r.faturaId}` })).toBe("processado");
    expect(await processarEventoPagamento({ faturaId: r.faturaId, evento: "PAGO", eventoId: `evt-${r.faturaId}` })).toBe("repetido");
    conta = await db.conta.findUniqueOrThrow({ where: { id: contaId } });
    expect(conta).toMatchObject({ plano: "CARTEIRA", planoPendente: null, situacaoCobranca: "EM_DIA" });
    expect(await db.fatura.findUnique({ where: { id: r.faturaId } })).toMatchObject({ status: "PAGA" });
  });

  it("três vencimentos de uma compra nova: a fatura falha, mas a conta não entra em carência (nada foi prestado)", async () => {
    // P0: antes, uma compra nunca paga deixava a conta em carência e depois somente leitura.
    // A régua de carência vale para renovação devida (assinatura.db.test.ts).
    const r = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "MENSAL", "BOLETO", email);
    for (let i = 0; i < 3; i++) await processarEventoPagamento({ faturaId: r.faturaId, evento: "VENCIDO" });
    const conta = await db.conta.findUniqueOrThrow({ where: { id: contaId } });
    expect(conta.situacaoCobranca).toBe("EM_DIA");
    expect(await db.fatura.findUnique({ where: { id: r.faturaId } })).toMatchObject({ status: "FALHOU", tentativas: 3 });
    expect(await db.empresa.count({ where: { contaId } })).toBe(1);
  });
});
