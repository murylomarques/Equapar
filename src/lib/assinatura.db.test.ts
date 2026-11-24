import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { situacaoEfetiva } from "./planos";
import { abrirCobrancaDoPlano, agendarMudanca, cancelarRenovacao, processarEventoPagamento, reativarRenovacao, renovarAssinaturas } from "./cobranca-servidor";

// P0 (npm run test:db): política de assinatura com uma conta fictícia temporária, gateway em simulação.
process.env.ASAAS_API_KEY = "";
const email = `assinatura-${Date.now()}@exemplo.local`;
let contaId = "";
const dia = 86_400_000;

beforeAll(async () => {
  const u = await db.usuario.create({
    data: { nome: "Dono (fictício)", email, membros: { create: { papel: "DONO", conta: { create: { nome: "Conta de teste da assinatura (fictícia)", empresas: { create: { cnpj: "11222333000181", razaoSocial: "Empresa Teste (fictícia)" } } } } } } },
    include: { membros: true },
  });
  contaId = u.membros[0].contaId;
});
beforeEach(async () => {
  await db.fatura.deleteMany({ where: { contaId } });
  await db.conta.update({ where: { id: contaId }, data: { plano: "GRATIS", planoPendente: null, planoVigenteAte: null, renovacaoCancelada: false, mudancaAgendada: null, mudancaAgendadaEm: null, situacaoCobranca: "EM_DIA", carenciaAte: null, ciclo: "MENSAL" } });
});
afterAll(async () => {
  await db.eventoCobranca.deleteMany({ where: { id: { startsWith: `t-${contaId}` } } });
  await db.conta.deleteMany({ where: { id: contaId } });
  await db.usuario.deleteMany({ where: { email } });
  await db.aviso.deleteMany({ where: { destino: email } });
  await db.$disconnect();
});

const conta = () => db.conta.findUniqueOrThrow({ where: { id: contaId } });
let seq = 0;
const evt = () => `t-${contaId}-${++seq}`;
async function comprar(plano: "CARTEIRA" | "ASSESSORIA" = "CARTEIRA", quando = new Date()) {
  const r = await abrirCobrancaDoPlano(contaId, plano, "MENSAL", "PIX", email, quando, { analiseManual: true });
  await processarEventoPagamento({ faturaId: r.faturaId, evento: "PAGO", eventoId: evt(), agora: quando });
  return r.faturaId;
}

describe("P0: compra, idempotência e eventos fora de ordem", () => {
  it("o plano só vale com o pagamento e ganha um período", async () => {
    const r = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "MENSAL", "PIX", email);
    expect((await conta()).plano).toBe("GRATIS");
    await processarEventoPagamento({ faturaId: r.faturaId, evento: "PAGO", eventoId: evt() });
    const c = await conta();
    expect(c.plano).toBe("CARTEIRA");
    expect(Math.round((c.planoVigenteAte!.getTime() - Date.now()) / dia)).toBeGreaterThanOrEqual(28);
  });
  it("a mesma entrega 5 vezes ao mesmo tempo é aplicada uma vez só", async () => {
    const r = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "MENSAL", "PIX", email);
    const id = evt();
    const res = await Promise.all(Array.from({ length: 5 }, () => processarEventoPagamento({ faturaId: r.faturaId, evento: "PAGO", eventoId: id })));
    expect(res.filter((x) => x === "processado")).toHaveLength(1);
    expect(res.filter((x) => x === "repetido")).toHaveLength(4);
    expect(await db.eventoCobranca.count({ where: { id } })).toBe(1);
  });
  it("vencimento que chega depois do pagamento não muda nada", async () => {
    const f = await comprar();
    expect(await processarEventoPagamento({ faturaId: f, evento: "VENCIDO", eventoId: evt() })).toBe("ignorado");
    expect(await conta()).toMatchObject({ plano: "CARTEIRA", situacaoCobranca: "EM_DIA" });
  });
  it("trocar de ideia antes de pagar substitui a cobrança anterior (pagar a antiga não ativa nada)", async () => {
    const a = await abrirCobrancaDoPlano(contaId, "ASSESSORIA", "MENSAL", "PIX", email, new Date(), { analiseManual: true });
    await abrirCobrancaDoPlano(contaId, "CARTEIRA", "MENSAL", "PIX", email);
    expect(await db.fatura.findUnique({ where: { id: a.faturaId } })).toMatchObject({ status: "CANCELADA" });
    await processarEventoPagamento({ faturaId: a.faturaId, evento: "PAGO", eventoId: evt() });
    expect(await db.fatura.findUnique({ where: { id: a.faturaId } })).toMatchObject({ status: "PAGA", revisao: "PAGA_APOS_CANCELAMENTO" });
    expect((await conta()).plano).toBe("GRATIS");
  });
});

describe("P0: cancelamento e downgrade", () => {
  it("Grátis com período pago: acesso até o fim do período, renovação futura cancelada, dados preservados", async () => {
    await comprar();
    const vigente = (await conta()).planoVigenteAte!;
    // renovação já gerada (7 dias antes do fim)
    await renovarAssinaturas(new Date(vigente.getTime() - 3 * dia));
    const renov = await db.fatura.findFirstOrThrow({ where: { contaId, renovacao: true } });
    expect(renov.status).toBe("ABERTA");
    const r = await cancelarRenovacao(contaId);
    expect(r).toMatchObject({ agendado: true, canceladas: 1 });
    expect(await conta()).toMatchObject({ plano: "CARTEIRA", renovacaoCancelada: true, mudancaAgendada: "GRATIS" });
    expect(await db.fatura.findUnique({ where: { id: renov.id } })).toMatchObject({ status: "CANCELADA" });
    // pagar a renovação cancelada não reativa a assinatura
    await processarEventoPagamento({ faturaId: renov.id, evento: "PAGO", eventoId: evt() });
    expect((await conta()).renovacaoCancelada).toBe(true);
    // depois do fim do período: Grátis, sem atraso, empresa e faturas continuam lá
    await renovarAssinaturas(new Date(vigente.getTime() + dia));
    expect(await conta()).toMatchObject({ plano: "GRATIS", situacaoCobranca: "EM_DIA", mudancaAgendada: null });
    expect(await db.empresa.count({ where: { contaId } })).toBe(1);
    expect(await db.fatura.count({ where: { contaId } })).toBe(2);
  });
  it("desfazer o cancelamento antes da data mantém a assinatura", async () => {
    await comprar();
    await cancelarRenovacao(contaId);
    await reativarRenovacao(contaId);
    expect(await conta()).toMatchObject({ plano: "CARTEIRA", renovacaoCancelada: false, mudancaAgendada: null });
  });
  it("Grátis sem período pago: imediato, e uma cobrança antiga vencida nunca deixa a conta somente leitura", async () => {
    const r = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "MENSAL", "BOLETO", email);
    await cancelarRenovacao(contaId);
    for (let i = 0; i < 3; i++) await processarEventoPagamento({ faturaId: r.faturaId, evento: "VENCIDO", eventoId: evt() });
    expect(await conta()).toMatchObject({ plano: "GRATIS", situacaoCobranca: "EM_DIA" });
  });
  it("downgrade de Assessoria para Carteira vale na renovação, cobrada no plano novo", async () => {
    await comprar("ASSESSORIA");
    const vigente = await agendarMudanca(contaId, "CARTEIRA");
    expect((await conta()).plano).toBe("ASSESSORIA");
    await renovarAssinaturas(new Date(vigente.getTime() - 2 * dia));
    const renov = await db.fatura.findFirstOrThrow({ where: { contaId, renovacao: true, status: "ABERTA" } });
    expect(renov).toMatchObject({ plano: "CARTEIRA" });
    expect(renov.valor.toString()).toBe("297");
    await processarEventoPagamento({ faturaId: renov.id, evento: "PAGO", eventoId: evt(), agora: new Date(vigente.getTime() + dia) });
    await renovarAssinaturas(new Date(vigente.getTime() + dia));
    expect((await conta()).plano).toBe("CARTEIRA");
  });
});

describe("P0: renovação, atraso e estornos", () => {
  it("rodar a renovação duas vezes (até ao mesmo tempo) gera uma fatura só", async () => {
    await comprar();
    const vigente = (await conta()).planoVigenteAte!;
    const quando = new Date(vigente.getTime() - 2 * dia);
    await Promise.all([renovarAssinaturas(quando), renovarAssinaturas(quando)]);
    await renovarAssinaturas(quando);
    expect(await db.fatura.count({ where: { contaId, renovacao: true } })).toBe(1);
  });
  it("renovação devida e não paga: régua de cobrança (o período começou, o serviço foi prestado)", async () => {
    await comprar();
    const vigente = (await conta()).planoVigenteAte!;
    await renovarAssinaturas(new Date(vigente.getTime() - dia));
    const renov = await db.fatura.findFirstOrThrow({ where: { contaId, renovacao: true } });
    const depois = new Date(vigente.getTime() + 2 * dia);
    for (let i = 0; i < 3; i++) await processarEventoPagamento({ faturaId: renov.id, evento: "VENCIDO", eventoId: evt(), agora: depois });
    expect(await conta()).toMatchObject({ plano: "CARTEIRA", situacaoCobranca: "CARENCIA" });
    // cancelar agora não apaga a fatura devida
    await cancelarRenovacao(contaId, depois);
    expect(await db.fatura.findUnique({ where: { id: renov.id } })).toMatchObject({ status: "FALHOU" });
  });
  it("pagamento atrasado da renovação mantém a continuidade do período", async () => {
    await comprar();
    const vigente = (await conta()).planoVigenteAte!;
    await renovarAssinaturas(new Date(vigente.getTime() - dia));
    const renov = await db.fatura.findFirstOrThrow({ where: { contaId, renovacao: true } });
    await processarEventoPagamento({ faturaId: renov.id, evento: "PAGO", eventoId: evt(), agora: new Date(vigente.getTime() + 5 * dia) });
    const f = await db.fatura.findUniqueOrThrow({ where: { id: renov.id } });
    expect(f.periodoInicio!.getTime()).toBe(vigente.getTime());
  });
  it("estorno integral do período atual: volta ao Grátis; estorno parcial: mantém e pede revisão", async () => {
    const f = await comprar();
    await processarEventoPagamento({ faturaId: f, evento: "ESTORNO_PARCIAL", valorEstornado: "50.00", eventoId: evt() });
    expect(await conta()).toMatchObject({ plano: "CARTEIRA" });
    expect(await db.fatura.findUnique({ where: { id: f } })).toMatchObject({ status: "PAGA", revisao: "ESTORNO_PARCIAL" });
    await processarEventoPagamento({ faturaId: f, evento: "ESTORNADO", eventoId: evt() });
    expect((await conta()).plano).toBe("GRATIS");
    // pagamento repetido que chega depois do estorno não reativa
    await processarEventoPagamento({ faturaId: f, evento: "PAGO", eventoId: evt() });
    expect((await conta()).plano).toBe("GRATIS");
  });
  it("estorno de um upgrade não tira o período anual já pago", async () => {
    const quando = new Date();
    const r = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "ANUAL", "PIX", email, quando);
    await processarEventoPagamento({ faturaId: r.faturaId, evento: "PAGO", eventoId: evt(), agora: quando });
    const up = await comprar("ASSESSORIA");
    expect((await conta()).plano).toBe("ASSESSORIA");
    await processarEventoPagamento({ faturaId: up, evento: "ESTORNADO", eventoId: evt() });
    expect((await conta()).plano).toBe("CARTEIRA");
  });
});

describe("P0: sem cobrança duplicada", () => {
  it("dois cliques simultâneos na mesma compra abrem uma cobrança só", async () => {
    const r = await Promise.all([1, 2, 3].map(() => abrirCobrancaDoPlano(contaId, "CARTEIRA", "MENSAL", "PIX", email)));
    expect(new Set(r.map((x) => x.faturaId)).size).toBe(1);
    expect(await db.fatura.count({ where: { contaId, status: "ABERTA" } })).toBe(1);
  });
  it("upgrade com renovação futura em aberto: a renovação é substituída", async () => {
    await comprar();
    const vigente = (await conta()).planoVigenteAte!;
    await renovarAssinaturas(new Date(vigente.getTime() - 2 * dia));
    const renov = await db.fatura.findFirstOrThrow({ where: { contaId, renovacao: true } });
    await abrirCobrancaDoPlano(contaId, "ASSESSORIA", "MENSAL", "PIX", email, new Date(), { analiseManual: true });
    expect(await db.fatura.findUnique({ where: { id: renov.id } })).toMatchObject({ status: "CANCELADA" });
    expect(await db.fatura.count({ where: { contaId, status: "ABERTA" } })).toBe(1);
  });
  it("com uma compra aguardando pagamento, a rotina não gera a renovação do plano antigo", async () => {
    await comprar();
    const vigente = (await conta()).planoVigenteAte!;
    const quando = new Date(vigente.getTime() - 2 * dia);
    await abrirCobrancaDoPlano(contaId, "ASSESSORIA", "MENSAL", "PIX", email, quando, { analiseManual: true });
    await renovarAssinaturas(quando);
    expect(await db.fatura.count({ where: { contaId, renovacao: true } })).toBe(0);
  });
});

describe("Auditoria independente: cenários reproduzidos e corrigidos", () => {
  it("renovação devida e nunca paga, sem nenhum evento do gateway: atraso, carência e somente leitura pelo calendário", async () => {
    await comprar();
    const vigente = (await conta()).planoVigenteAte!;
    await renovarAssinaturas(new Date(vigente.getTime() - dia));
    await renovarAssinaturas(new Date(vigente.getTime() + 3 * dia));
    expect((await conta()).situacaoCobranca).toBe("ATRASADA");
    await renovarAssinaturas(new Date(vigente.getTime() + 12 * dia));
    const c = await conta();
    expect(c.situacaoCobranca).toBe("CARENCIA");
    expect(situacaoEfetiva(c.situacaoCobranca, c.carenciaAte, new Date(vigente.getTime() + 26 * dia))).toBe("SOMENTE_LEITURA");
  });
  it("renovação que ficou sem cobrança no gateway é refeita na próxima rodada", async () => {
    await comprar();
    const vigente = (await conta()).planoVigenteAte!;
    await renovarAssinaturas(new Date(vigente.getTime() - 2 * dia));
    const renov = await db.fatura.findFirstOrThrow({ where: { contaId, renovacao: true } });
    await db.fatura.update({ where: { id: renov.id }, data: { gatewayId: null, linkPagamento: null } });
    await renovarAssinaturas(new Date(vigente.getTime() - dia));
    expect((await db.fatura.findUniqueOrThrow({ where: { id: renov.id } })).gatewayId).toBeTruthy();
    expect(await db.fatura.count({ where: { contaId, renovacao: true } })).toBe(1);
  });
  it("cliques simultâneos: a mesma fatura e a mesma cobrança no gateway", async () => {
    const r = await Promise.all([1, 2, 3].map(() => abrirCobrancaDoPlano(contaId, "CARTEIRA", "MENSAL", "PIX", email)));
    expect(new Set(r.map((x) => x.link)).size).toBe(1);
    const f = await db.fatura.findFirstOrThrow({ where: { contaId, status: "ABERTA" } });
    expect(f.gatewayId).toBeTruthy();
  });
  it("pagamento de uma cobrança duplicada em cima de fatura já paga: fica marcado para devolução", async () => {
    const f = await comprar();
    await processarEventoPagamento({ gatewayId: "sim_pay_duplicada", faturaId: f, evento: "PAGO", eventoId: evt() });
    expect(await db.fatura.findUnique({ where: { id: f } })).toMatchObject({ status: "PAGA", revisao: "PAGAMENTO_DUPLICADO" });
  });
  it("abrir um upgrade não desfaz o cancelamento; só o pagamento desfaz", async () => {
    await comprar();
    await cancelarRenovacao(contaId);
    const up = await abrirCobrancaDoPlano(contaId, "ASSESSORIA", "MENSAL", "PIX", email, new Date(), { analiseManual: true });
    expect(await conta()).toMatchObject({ renovacaoCancelada: true, mudancaAgendada: "GRATIS" });
    await processarEventoPagamento({ faturaId: up.faturaId, evento: "PAGO", eventoId: evt() });
    expect(await conta()).toMatchObject({ plano: "ASSESSORIA", renovacaoCancelada: false, mudancaAgendada: null });
  });
  it("restauração no gateway de uma cobrança que o cliente cancelou é ignorada", async () => {
    const r = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "MENSAL", "PIX", email);
    await cancelarRenovacao(contaId);
    expect(await processarEventoPagamento({ faturaId: r.faturaId, evento: "RESTAURADO", eventoId: evt() })).toBe("ignorado");
    expect((await db.fatura.findUniqueOrThrow({ where: { id: r.faturaId } })).status).toBe("CANCELADA");
  });
});

describe("Revisão final: sem cobrança ambígua pela tela", () => {
  it("com período pago em andamento, a compra pela tela é recusada (vai para análise manual)", async () => {
    await comprar();
    await expect(abrirCobrancaDoPlano(contaId, "ASSESSORIA", "MENSAL", "PIX", email)).rejects.toThrow(/período pago em andamento/);
    expect(await db.fatura.count({ where: { contaId, status: "ABERTA" } })).toBe(0);
  });
  it("com renovação vencida em aberto, uma compra nova é recusada (cobraria o mesmo período duas vezes)", async () => {
    await comprar();
    const vigente = (await conta()).planoVigenteAte!;
    await renovarAssinaturas(new Date(vigente.getTime() - dia));
    const depois = new Date(vigente.getTime() + 3 * dia);
    await expect(abrirCobrancaDoPlano(contaId, "CARTEIRA", "MENSAL", "PIX", email, depois)).rejects.toThrow(/renovação vencida em aberto/);
  });
});
