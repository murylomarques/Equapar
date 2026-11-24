import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { PDFDocument } from "pdf-lib";
import type Anthropic from "@anthropic-ai/sdk";
import { APIConnectionTimeoutError, APIError } from "@anthropic-ai/sdk";
import { db } from "./db";
import { definirClienteIa, lerPlanilhaPdf } from "./ia";
import { eReserva, expirarReservasIa, periodoDe, reservar } from "./ia-orcamento";

// P0 (npm run test:db): orçamento de IA com limites FICTÍCIOS e um cliente falso da API: nenhuma chamada paga sai daqui.
const prefixo = `teste-ia-${Date.now()}`;
const contas = Array.from({ length: 6 }, (_, i) => `${prefixo}-c${i}`);
const ids = () => db.usoIa.findMany({ where: { contaId: { in: contas } } });

let pdf1: Buffer;
let pdf2: Buffer;
beforeAll(async () => {
  const novo = async (paginas: number, marca: string) => {
    const d = await PDFDocument.create();
    for (let i = 0; i < paginas; i++) d.addPage().drawText(`${marca} ${i}`);
    return Buffer.from(await d.save());
  };
  pdf1 = await novo(1, "planilha A");
  pdf2 = await novo(1, "planilha B");
});
beforeEach(() => {
  // limites fictícios só para o teste: US$ 1 por conta, US$ 2 no total
  vi.stubEnv("IA_ORCAMENTO_GLOBAL_USD_MES", "2");
  vi.stubEnv("IA_ORCAMENTO_CARTEIRA_USD_MES", "1");
  vi.stubEnv("IA_CONCORRENCIA_CONTA", "20");
  vi.stubEnv("IA_CONCORRENCIA_GLOBAL", "50");
  vi.stubEnv("IA_LIMITE_USUARIO_DIA", "100");
  vi.stubEnv("IA_TENTATIVAS", "2");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await db.usoIa.deleteMany({ where: { contaId: { in: contas } } });
  await db.cacheIa.deleteMany({ where: { contaId: { in: contas } } });
  // cada teste começa sem nada no mês (os outros registros do banco local não contam no teto global deste teste)
});
afterAll(async () => {
  await db.$disconnect();
});

// o teto global soma o mês inteiro do banco: o teste usa um mês só dele
const MES_TESTE = new Date(Date.UTC(2099, 0, 15));
const r = (contaId: string, extra: Partial<Parameters<typeof reservar>[0]> = {}) =>
  reservar({ contaId, usuarioId: null, plano: "CARTEIRA", operacao: "LEITURA_PLANILHA", modelo: "claude-opus-5-5", bytes: 1000, paginas: 1, tokensExtras: 500, hashDocumento: "h", tentativa: 1, agora: MES_TESTE, ...extra });

describe("P0: reserva atômica de orçamento", () => {
  it("20 reservas simultâneas da mesma conta não passam do teto da conta", async () => {
    const res = await Promise.all(Array.from({ length: 20 }, () => r(contas[0])));
    const ok = res.filter(eReserva);
    const total = ok.reduce((s, x) => s.plus(x.custoReservadoUsd), new Decimal(0));
    expect(ok.length).toBeGreaterThan(0);
    expect(total.lte(1)).toBe(true);
    expect(res.filter((x) => !eReserva(x)).every((x) => !eReserva(x) && x.codigo === "CONTA_ESGOTADA")).toBe(true);
  });
  it("várias contas ao mesmo tempo não passam do teto global do SaaS", async () => {
    const res = await Promise.all(contas.flatMap((c) => Array.from({ length: 4 }, () => r(c))));
    const total = res.filter(eReserva).reduce((s, x) => s.plus(x.custoReservadoUsd), new Decimal(0));
    expect(total.lte(2)).toBe(true);
    expect(res.some((x) => !eReserva(x) && x.codigo === "GLOBAL_ESGOTADO")).toBe(true);
  });
  it("Grátis, orçamento zero e documento grande são bloqueados sem gravar nada", async () => {
    expect(await r(contas[0], { plano: "GRATIS" })).toMatchObject({ codigo: "PLANO" });
    vi.stubEnv("IA_ORCAMENTO_CARTEIRA_USD_MES", "0");
    expect(await r(contas[0])).toMatchObject({ codigo: "SEM_ORCAMENTO" });
    vi.stubEnv("IA_ORCAMENTO_CARTEIRA_USD_MES", "1");
    expect(await r(contas[0], { paginas: 500 })).toMatchObject({ codigo: "GRANDE_DEMAIS" });
    expect(await ids()).toHaveLength(0);
  });
  it("concorrência por conta e limite diário por usuário", async () => {
    vi.stubEnv("IA_CONCORRENCIA_CONTA", "1");
    expect(eReserva(await r(contas[1]))).toBe(true);
    expect(await r(contas[1])).toMatchObject({ codigo: "OCUPADO" });
    vi.stubEnv("IA_CONCORRENCIA_CONTA", "20");
    vi.stubEnv("IA_LIMITE_USUARIO_DIA", "1");
    await db.usoIa.create({ data: { contaId: contas[2], usuarioId: `${prefixo}-u`, operacao: "LEITURA_PLANILHA", modelo: "claude-opus-5-5", periodo: periodoDe(MES_TESTE), status: "CONCLUIDO", custoReservadoUsd: "0.1", custoRealUsd: "0.01", bytes: 1, tentativa: 1, criadoEm: MES_TESTE } });
    expect(await r(contas[2], { usuarioId: `${prefixo}-u` })).toMatchObject({ codigo: "USUARIO_DIA" });
  });
  it("reserva esquecida expira contando o valor reservado (conservador)", async () => {
    const x = await r(contas[3]);
    if (!eReserva(x)) throw new Error("deveria reservar");
    await db.usoIa.update({ where: { id: x.id }, data: { criadoEm: new Date(Date.now() - 60 * 60_000) } });
    expect(await expirarReservasIa()).toBeGreaterThanOrEqual(1);
    const u = await db.usoIa.findUniqueOrThrow({ where: { id: x.id } });
    expect(u.status).toBe("EXPIRADO");
    expect(u.custoRealUsd?.toString()).toBe(u.custoReservadoUsd.toString());
  });
});

// cliente falso: devolve o que cada teste mandar
type Passo = { erro?: unknown; usage?: { input_tokens: number; output_tokens: number } };
function clienteFalso(passos: Passo[]) {
  let i = 0;
  const chamadas = { n: 0 };
  const cliente = {
    messages: {
      parse: async () => {
        chamadas.n++;
        const p = passos[Math.min(i++, passos.length - 1)];
        if (p.erro) throw p.erro;
        return { parsed_output: { postos: [{ nome: "Servente", quantidade: 1, linhas: [] }], observacoes: "" }, stop_reason: "end_turn", usage: p.usage ?? { input_tokens: 3000, output_tokens: 800 } };
      },
    },
  } as unknown as Anthropic;
  definirClienteIa(() => cliente);
  return chamadas;
}
const quem = (contaId: string, plano: "CARTEIRA" | "GRATIS" = "CARTEIRA") => ({ contaId, usuarioId: null, plano });

describe("P0: leitura com IA de ponta a ponta (cliente falso)", () => {
  it("custo real consolidado, e o mesmo documento de novo sai do cache sem nova despesa", async () => {
    const chamadas = clienteFalso([{}]);
    await lerPlanilhaPdf(pdf1, quem(contas[0]));
    await lerPlanilhaPdf(pdf1, quem(contas[0]));
    expect(chamadas.n).toBe(1);
    const u = await ids();
    expect(u.map((x) => x.status).sort()).toEqual(["CACHE", "CONCLUIDO"]);
    const pago = u.find((x) => x.status === "CONCLUIDO")!;
    expect(pago.custoRealUsd!.toFixed(4)).toBe(((3000 * 4 + 800 * 20) / 1e6).toFixed(4));
    expect(pago.custoRealUsd!.lt(pago.custoReservadoUsd)).toBe(true);
  });
  it("erro 500 da API: não cobra, tenta de novo uma vez e conclui", async () => {
    const chamadas = clienteFalso([{ erro: new APIError(500, {}, "erro interno", new Headers()) }, {}]);
    await lerPlanilhaPdf(pdf2, quem(contas[1]));
    expect(chamadas.n).toBe(2);
    const u = await ids();
    expect(u.map((x) => x.status).sort()).toEqual(["CONCLUIDO", "FALHOU"]);
    expect(u.find((x) => x.status === "FALHOU")!.custoRealUsd!.toString()).toBe("0");
  });
  it("tempo esgotado: custo incerto conta o reservado; desiste depois do limite de tentativas", async () => {
    const chamadas = clienteFalso([{ erro: new APIConnectionTimeoutError() }]);
    await expect(lerPlanilhaPdf(pdf1, quem(contas[2]))).rejects.toThrow(/Não foi possível ler/);
    expect(chamadas.n).toBe(2);
    const u = await ids();
    expect(u.every((x) => x.status === "INCERTO" && x.custoRealUsd!.eq(x.custoReservadoUsd))).toBe(true);
  });
  it("erro 400 (pedido inválido) não é repetido", async () => {
    const chamadas = clienteFalso([{ erro: new APIError(400, {}, "inválido", new Headers()) }]);
    await expect(lerPlanilhaPdf(pdf1, quem(contas[3]))).rejects.toThrow();
    expect(chamadas.n).toBe(1);
  });
  it("Grátis tentando usar: bloqueado antes de qualquer chamada", async () => {
    const chamadas = clienteFalso([{}]);
    await expect(lerPlanilhaPdf(pdf1, quem(contas[4], "GRATIS"))).rejects.toThrow(/não faz parte do plano Grátis/);
    expect(chamadas.n).toBe(0);
    expect(await ids()).toHaveLength(0);
  });
  it("conta que lê muitas vezes esbarra no teto e para de gastar", async () => {
    clienteFalso([{ usage: { input_tokens: 6000, output_tokens: 15000 } }]);
    let bloqueada = false;
    for (let i = 0; i < 10 && !bloqueada; i++) {
      const d = await PDFDocument.create();
      d.addPage().drawText(`documento ${i}`);
      try {
        await lerPlanilhaPdf(Buffer.from(await d.save()), quem(contas[5]));
      } catch (e) {
        bloqueada = /cota de leitura com IA deste mês acabou/.test(String(e));
      }
    }
    expect(bloqueada).toBe(true);
    const gasto = (await ids()).reduce((s, x) => s.plus(x.custoRealUsd ?? x.custoReservadoUsd), new Decimal(0));
    expect(gasto.lte(1)).toBe(true);
  });
  it("sem orçamento configurado (o padrão de produção): nenhuma chamada", async () => {
    vi.unstubAllEnvs();
    const chamadas = clienteFalso([{}]);
    await expect(lerPlanilhaPdf(pdf1, quem(contas[0]))).rejects.toThrow(/ainda não está liberada/);
    expect(chamadas.n).toBe(0);
  });
});
