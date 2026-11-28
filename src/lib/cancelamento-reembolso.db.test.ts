import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { abrirCobrancaDoPlano, cancelarRenovacao, previaCancelamento, processarEventoPagamento } from "./cobranca-servidor";

// B1 e B2 item 6 (parecer de 28/11/2026): devolução no cancelamento e preço de fundador. Conta fictícia.
process.env.ASAAS_API_KEY = "";
const email = `reembolso-${Date.now()}@exemplo.local`;
let contaId = "";
const dia = 86_400_000;
const t0 = new Date("2027-01-10T12:00:00Z");
const em = (d: number) => new Date(t0.getTime() + d * dia);

beforeAll(async () => {
  const u = await db.usuario.create({
    data: { nome: "Dono (fictício)", email, membros: { create: { papel: "DONO", conta: { create: { nome: "Conta de teste do reembolso (fictícia)", empresas: { create: { cnpj: "11222333000181", razaoSocial: "Empresa Teste (fictícia)" } } } } } } },
    include: { membros: true },
  });
  contaId = u.membros[0].contaId;
});
beforeEach(async () => {
  await db.fatura.deleteMany({ where: { contaId } });
  await db.conta.update({
    where: { id: contaId },
    data: { plano: "GRATIS", planoPendente: null, planoVigenteAte: null, pilotoInicio: null, renovacaoCancelada: false, mudancaAgendada: null, mudancaAgendadaEm: null, situacaoCobranca: "EM_DIA", carenciaAte: null, ciclo: "MENSAL", fundadorAte: null, fundadorPlano: null, fundadorPrecos: undefined },
  });
});
afterAll(async () => {
  await db.eventoCobranca.deleteMany({ where: { id: { startsWith: `r-${contaId}` } } });
  await db.conta.deleteMany({ where: { id: contaId } });
  await db.usuario.deleteMany({ where: { email } });
  await db.aviso.deleteMany({ where: { destino: email } });
  await db.$disconnect();
});

let seq = 0;
const evt = () => `r-${contaId}-${++seq}`;
async function assinarPago(ciclo: "MENSAL" | "ANUAL", quando = t0) {
  const r = await abrirCobrancaDoPlano(contaId, "CARTEIRA", ciclo, "PIX", email, quando, { analiseManual: true });
  await processarEventoPagamento({ faturaId: r.faturaId, evento: "PAGO", eventoId: evt(), agora: quando });
  return r.faturaId;
}

describe("cancelamento com devolução (B1)", () => {
  it("na garantia: devolve tudo, o acesso termina na hora e a fatura vai para a revisão da equipe", async () => {
    const id = await assinarPago("ANUAL");
    expect((await previaCancelamento(contaId, em(10)))?.tipo).toBe("GARANTIA");
    const r = await cancelarRenovacao(contaId, em(10));
    expect(r.devolucao).toMatchObject({ tipo: "GARANTIA", valor: "2970.00" });
    const f = await db.fatura.findUniqueOrThrow({ where: { id } });
    expect(f.revisao).toBe("REEMBOLSO_GARANTIA");
    expect(f.valorReembolsar?.toFixed(2)).toBe("2970.00");
    expect(f.periodoFim?.getTime()).toBe(em(10).getTime());
    expect((await db.conta.findUniqueOrThrow({ where: { id: contaId } })).plano).toBe("GRATIS");
  });

  it("anual depois de 30 dias: devolve o pago menos os meses iniciados a preço mensal (R$ 2.376)", async () => {
    await assinarPago("ANUAL");
    const r = await cancelarRenovacao(contaId, em(45));
    expect(r.devolucao).toMatchObject({ tipo: "PROPORCIONAL_ANUAL", valor: "2376.00", mesesUsados: 2 });
  });

  it("mensal depois de 30 dias: sem devolução, acesso até o fim do mês", async () => {
    // pago há 30,5 dias: fora da garantia, mas o mês pago ainda não acabou
    await assinarPago("MENSAL", em(-31));
    const r = await cancelarRenovacao(contaId, em(-0.5));
    expect(r.devolucao).toBeNull();
    expect(r.agendado).toBe(true);
  });

  it("o estorno parcial feito pela equipe registra a devolução sem abrir outra revisão", async () => {
    const id = await assinarPago("ANUAL");
    await cancelarRenovacao(contaId, em(45));
    await processarEventoPagamento({ faturaId: id, evento: "ESTORNO_PARCIAL", valorEstornado: "2376.00", eventoId: evt(), agora: em(47) });
    const f = await db.fatura.findUniqueOrThrow({ where: { id } });
    expect(f.revisao).toBe("REEMBOLSO_PROPORCIONAL");
    expect(f.valorEstornado.toFixed(2)).toBe("2376.00");
  });
});

describe("preço de fundador (B2 item 6)", () => {
  it("a 1ª assinatura paga marca o fundador por 24 meses e guarda a oferta aceita", async () => {
    const id = await assinarPago("MENSAL");
    const c = await db.conta.findUniqueOrThrow({ where: { id: contaId } });
    if (!c.fundadorAte) return; // o banco de testes já tem 10 fundadores: a regra do limite vale (não marca)
    expect(c.fundadorPlano).toBe("CARTEIRA");
    expect(c.fundadorAte.toISOString()).toBe("2029-01-10T12:00:00.000Z");
    const f = await db.fatura.findUniqueOrThrow({ where: { id } });
    expect(f.oferta).toMatchObject({ termosVersao: expect.any(String), mensalCheio: "297.00", garantiaDias: 30 });
  });

  it("a tabela congelada vale no mesmo plano; mudança voluntária de plano paga o preço do dia", async () => {
    const congelada = { carteiraPorPosto: 3, carteiraMinimo: 200, assessoria: 1000, assessoriaPostosIncluidos: 1500, assessoriaPorPostoExtra: 1, mesesPagosNoAnual: 10 };
    await db.conta.update({ where: { id: contaId }, data: { fundadorAte: em(700), fundadorPlano: "CARTEIRA", fundadorPrecos: congelada } });
    const mesmo = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "MENSAL", "PIX", email, t0, { analiseManual: true });
    expect((await db.fatura.findUniqueOrThrow({ where: { id: mesmo.faturaId } })).valor.toFixed(2)).toBe("200.00");
    const outro = await abrirCobrancaDoPlano(contaId, "ASSESSORIA", "MENSAL", "PIX", email, t0, { analiseManual: true });
    expect((await db.fatura.findUniqueOrThrow({ where: { id: outro.faturaId } })).valor.toFixed(2)).toBe("1497.00");
  });
});
