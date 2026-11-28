import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { abrirCobrancaDoPlano, MARCA_ABATIMENTO_PILOTO, processarEventoPagamento } from "./cobranca-servidor";

// Decisão do dono (27/11/2026): o valor pago no Piloto é abatido da 1ª fatura anual feita em até 60 dias. Conta fictícia.
process.env.ASAAS_API_KEY = "";
const email = `abatimento-${Date.now()}@exemplo.local`;
let contaId = "";
const dia = 86_400_000;
const inicioPiloto = new Date("2026-12-01T12:00:00Z");

beforeAll(async () => {
  const u = await db.usuario.create({
    data: { nome: "Dono (fictício)", email, membros: { create: { papel: "DONO", conta: { create: { nome: "Conta de teste do abatimento (fictícia)", empresas: { create: { cnpj: "11222333000181", razaoSocial: "Empresa Teste (fictícia)" } } } } } } },
    include: { membros: true },
  });
  contaId = u.membros[0].contaId;
});
beforeEach(async () => {
  await db.fatura.deleteMany({ where: { contaId } });
  await db.conta.update({ where: { id: contaId }, data: { plano: "GRATIS", planoPendente: null, planoVigenteAte: null, pilotoInicio: inicioPiloto, renovacaoCancelada: false, mudancaAgendada: null, mudancaAgendadaEm: null, situacaoCobranca: "EM_DIA", carenciaAte: null, ciclo: "MENSAL" } });
  // o Piloto pago: R$ 1.500
  await db.fatura.create({ data: { contaId, referencia: "2026-12", descricao: "Piloto (fictício)", valor: "1500.00", postos: 0, plano: "PILOTO", ciclo: "MENSAL", status: "PAGA" } });
});
afterAll(async () => {
  await db.eventoCobranca.deleteMany({ where: { id: { startsWith: `t-${contaId}` } } });
  await db.conta.deleteMany({ where: { id: contaId } });
  await db.usuario.deleteMany({ where: { email } });
  await db.aviso.deleteMany({ where: { destino: email } });
  await db.$disconnect();
});

let seq = 0;
const evt = () => `t-${contaId}-${++seq}`;
const fatura = (id: string) => db.fatura.findUniqueOrThrow({ where: { id } });

describe("abatimento do Piloto no anual", () => {
  it("anual da Carteira em até 60 dias: R$ 2.970 − R$ 1.500 = R$ 1.470, marcado na descrição", async () => {
    const r = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "ANUAL", "PIX", email, new Date(inicioPiloto.getTime() + 30 * dia), { analiseManual: true });
    const f = await fatura(r.faturaId);
    expect(f.valor.toFixed(2)).toBe("1470.00");
    expect(f.descricao).toContain(MARCA_ABATIMENTO_PILOTO);
  });

  it("depois de 60 dias, ou no mensal, não abate", async () => {
    const tarde = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "ANUAL", "PIX", email, new Date(inicioPiloto.getTime() + 61 * dia), { analiseManual: true });
    expect((await fatura(tarde.faturaId)).valor.toFixed(2)).toBe("2970.00");
    const mensal = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "MENSAL", "PIX", email, new Date(inicioPiloto.getTime() + 10 * dia), { analiseManual: true });
    expect((await fatura(mensal.faturaId)).valor.toFixed(2)).toBe("297.00");
  });

  it("abate uma vez só: com o anual abatido pago, a próxima compra anual vem cheia", async () => {
    const quando = new Date(inicioPiloto.getTime() + 20 * dia);
    const r = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "ANUAL", "PIX", email, quando, { analiseManual: true });
    await processarEventoPagamento({ faturaId: r.faturaId, evento: "PAGO", eventoId: evt(), agora: quando });
    const de_novo = await abrirCobrancaDoPlano(contaId, "ASSESSORIA", "ANUAL", "PIX", email, new Date(quando.getTime() + dia), { analiseManual: true });
    expect((await fatura(de_novo.faturaId)).valor.toFixed(2)).toBe("14970.00");
  });

  it("Piloto estornado não abate", async () => {
    await db.fatura.updateMany({ where: { contaId, plano: "PILOTO" }, data: { valorEstornado: "1500.00" } });
    const r = await abrirCobrancaDoPlano(contaId, "CARTEIRA", "ANUAL", "PIX", email, new Date(inicioPiloto.getTime() + 5 * dia), { analiseManual: true });
    expect((await fatura(r.faturaId)).valor.toFixed(2)).toBe("2970.00");
  });
});
