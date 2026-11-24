import { describe, expect, it } from "vitest";
import { direitoDeAcesso, faturaCancelavel, faturaDevida, fimDoPeriodo, planoEfetivo, preverMudanca, transicao, type ContaRegra, type FaturaRegra } from "./assinatura";

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const agora = d("2026-11-24");
const paga = (plano: "CARTEIRA" | "ASSESSORIA", ini: string, fim: string, extra: Partial<FaturaRegra> = {}): FaturaRegra => ({
  status: "PAGA",
  valor: "297",
  plano,
  ciclo: "MENSAL",
  periodoInicio: d(ini),
  periodoFim: d(fim),
  ...extra,
});
const conta = (c: Partial<ContaRegra> = {}): ContaRegra => ({ plano: "CARTEIRA", planoVigenteAte: d("2026-12-10"), renovacaoCancelada: false, mudancaAgendada: null, mudancaAgendadaEm: null, ...c });

describe("P0: período pago", () => {
  it("mensal e anual; dia 31 vira o último dia do mês", () => {
    expect(fimDoPeriodo(d("2026-01-31"), "MENSAL").toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(fimDoPeriodo(d("2026-11-24"), "MENSAL").toISOString().slice(0, 10)).toBe("2026-12-24");
    expect(fimDoPeriodo(d("2026-11-24"), "ANUAL").toISOString().slice(0, 10)).toBe("2027-11-24");
  });
});

describe("P0: transições dos eventos (fora de ordem e repetidos)", () => {
  const aberta: FaturaRegra = { status: "ABERTA", valor: "297", plano: "CARTEIRA", ciclo: "MENSAL", periodoInicio: null };
  it("pago: compra nova começa no pagamento; renovação mantém o início marcado", () => {
    expect(transicao(aberta, "PAGO", agora).periodo).toEqual({ inicio: agora, fim: d("2026-12-24") });
    const renov = { ...aberta, periodoInicio: d("2026-12-10") };
    expect(transicao(renov, "PAGO", agora).periodo?.inicio).toEqual(d("2026-12-10"));
  });
  it("vencimento depois do pagamento é ignorado; pagamento repetido também", () => {
    expect(transicao({ ...aberta, status: "PAGA" }, "VENCIDO", agora).mudou).toBe(false);
    expect(transicao({ ...aberta, status: "PAGA" }, "PAGO", agora).mudou).toBe(false);
    expect(transicao({ ...aberta, status: "CANCELADA" }, "VENCIDO", agora).mudou).toBe(false);
  });
  it("pagamento depois do cancelamento não dá acesso: fica para devolução", () => {
    const t = transicao({ ...aberta, status: "CANCELADA" }, "PAGO", agora);
    expect(t).toMatchObject({ status: "PAGA", revisao: "PAGA_APOS_CANCELAMENTO" });
    expect(t.periodo).toBeUndefined();
  });
  it("estorno integral tira o período; pagamento atrasado que chega depois do estorno não reativa", () => {
    expect(transicao(paga("CARTEIRA", "2026-11-10", "2026-12-10"), "ESTORNADO", agora)).toMatchObject({ status: "ESTORNADA", valorEstornado: "297.00" });
    expect(transicao({ ...aberta, status: "ESTORNADA" }, "PAGO", agora).mudou).toBe(false);
  });
  it("estorno parcial mantém o acesso e pede revisão; parcial do valor total vira integral", () => {
    const p = paga("CARTEIRA", "2026-11-10", "2026-12-10");
    expect(transicao(p, "ESTORNO_PARCIAL", agora, { valorEstornado: "100" })).toMatchObject({ valorEstornado: "100.00", revisao: "ESTORNO_PARCIAL" });
    expect(transicao(p, "ESTORNO_PARCIAL", agora, { valorEstornado: "100" }).status).toBeUndefined();
    expect(transicao(p, "ESTORNO_PARCIAL", agora, { valorEstornado: "297" }).status).toBe("ESTORNADA");
  });
  it("cancelamento no gateway só vale para fatura em aberto; restauração reabre", () => {
    expect(transicao(paga("CARTEIRA", "2026-11-10", "2026-12-10"), "CANCELADO", agora).mudou).toBe(false);
    expect(transicao({ ...aberta, status: "CANCELADA" }, "RESTAURADO", agora).status).toBe("ABERTA");
  });
});

describe("P0: direito de acesso pelos períodos pagos", () => {
  it("renovações contínuas emendam o fim do acesso", () => {
    const r = direitoDeAcesso([paga("CARTEIRA", "2026-10-24", "2026-11-24"), paga("CARTEIRA", "2026-11-24", "2026-12-24"), paga("CARTEIRA", "2026-12-24", "2027-01-24")], d("2026-11-25"));
    expect(r.plano).toBe("CARTEIRA");
    expect(r.ate?.toISOString().slice(0, 10)).toBe("2027-01-24");
  });
  it("upgrade no meio do ciclo: vale o período que começou por último", () => {
    expect(direitoDeAcesso([paga("CARTEIRA", "2026-11-01", "2026-12-01"), paga("ASSESSORIA", "2026-11-20", "2026-12-20")], agora).plano).toBe("ASSESSORIA");
  });
  it("estorno integral do período atual tira só ele; o período anual pago antes continua", () => {
    const anual = paga("CARTEIRA", "2026-06-01", "2027-06-01", { ciclo: "ANUAL" });
    const upgradeEstornado = paga("ASSESSORIA", "2026-11-20", "2026-12-20", { status: "ESTORNADA" });
    expect(direitoDeAcesso([anual, upgradeEstornado], agora)).toMatchObject({ plano: "CARTEIRA" });
  });
  it("renovação paga depois do cancelamento não estende o acesso", () => {
    expect(direitoDeAcesso([paga("CARTEIRA", "2026-11-20", "2026-12-20", { revisao: "PAGA_APOS_CANCELAMENTO" })], agora).plano).toBeNull();
  });
  it("sem período ativo: nenhum acesso pago", () => {
    expect(direitoDeAcesso([paga("CARTEIRA", "2026-09-01", "2026-10-01")], agora).plano).toBeNull();
  });
});

describe("P0: plano efetivo", () => {
  it("cancelou a renovação: segue pago até o fim do período, depois Grátis", () => {
    const f = [paga("CARTEIRA", "2026-11-10", "2026-12-10")];
    const c = conta({ renovacaoCancelada: true, mudancaAgendada: "GRATIS", mudancaAgendadaEm: d("2026-12-10") });
    expect(planoEfetivo(c, f, agora).plano).toBe("CARTEIRA");
    expect(planoEfetivo(c, f, d("2026-12-11"))).toMatchObject({ plano: "GRATIS", limparAgendamento: true });
  });
  it("renovação vencida e devida: mantém o plano enquanto a régua de cobrança corre", () => {
    const f = [paga("CARTEIRA", "2026-10-10", "2026-11-10"), { status: "FALHOU", valor: "297", plano: "CARTEIRA" as const, ciclo: "MENSAL", periodoInicio: d("2026-11-10"), periodoFim: d("2026-12-10") }];
    expect(planoEfetivo(conta({ planoVigenteAte: d("2026-11-10") }), f, agora).plano).toBe("CARTEIRA");
  });
  it("conta com plano manual (sem compra registrada) não é rebaixada", () => {
    expect(planoEfetivo(conta({ plano: "PILOTO", planoVigenteAte: null }), [], agora).plano).toBe("PILOTO");
  });
});

describe("P0: o que pode ser cancelado", () => {
  it("fatura cujo período começou é devida (serviço prestado); compra ou renovação futura pode ser cancelada", () => {
    const iniciada = { status: "ABERTA", periodoInicio: d("2026-11-10") };
    const futura = { status: "ABERTA", periodoInicio: d("2026-12-10") };
    const compra = { status: "ABERTA", periodoInicio: null };
    expect(faturaDevida(iniciada, agora)).toBe(true);
    expect(faturaCancelavel(iniciada, agora)).toBe(false);
    expect(faturaCancelavel(futura, agora)).toBe(true);
    expect(faturaCancelavel(compra, agora)).toBe(true);
    expect(faturaCancelavel({ status: "PAGA", periodoInicio: null }, agora)).toBe(false);
  });
});

describe("P0: previsão mostrada antes de confirmar", () => {
  it("Grátis com período pago: agendado para o fim do período, dados preservados", () => {
    const p = preverMudanca(conta(), "GRATIS", agora);
    expect(p).toMatchObject({ possivel: true, efeito: "AGENDADO", quando: d("2026-12-10") });
    expect(p.linhas.join(" ")).toMatch(/10\/12\/2026.*exportad/);
  });
  it("Grátis sem período pago: imediato", () => {
    expect(preverMudanca(conta({ planoVigenteAte: null }), "GRATIS", agora).efeito).toBe("IMEDIATO");
  });
  it("downgrade pago: na renovação; upgrade: depois do pagamento, sem crédito automático", () => {
    expect(preverMudanca(conta({ plano: "ASSESSORIA" }), "CARTEIRA", agora).efeito).toBe("AGENDADO");
    const up = preverMudanca(conta(), "ASSESSORIA", agora);
    expect(up.efeito).toBe("IMEDIATO_APOS_PAGAMENTO");
    expect(up.linhas.join(" ")).toMatch(/não é convertido em crédito/);
  });
  it("mesmo plano: bloqueado; com renovação cancelada: reativar; troca de ciclo: na renovação", () => {
    expect(preverMudanca(conta(), "CARTEIRA", agora).possivel).toBe(false);
    expect(preverMudanca(conta({ renovacaoCancelada: true }), "CARTEIRA", agora).efeito).toBe("REATIVAR");
    expect(preverMudanca({ ...conta(), ciclo: "MENSAL" }, "CARTEIRA", agora, "ANUAL").efeito).toBe("AGENDADO");
  });
  it("Piloto é por pedido: não abre cobrança pela tela", () => {
    expect(preverMudanca(conta(), "PILOTO", agora).possivel).toBe(false);
  });
});
