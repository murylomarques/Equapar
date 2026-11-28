import { describe, expect, it } from "vitest";
import { calcularReembolso, mesesIniciados } from "./reembolso";

const dia = 86_400_000;
const inicio = new Date("2027-01-10T12:00:00Z");
const em = (dias: number) => new Date(inicio.getTime() + dias * dia);
const anual = { valor: "2970.00", ciclo: "ANUAL", periodoInicio: inicio, pagaEm: inicio };
const mensal = { valor: "297.00", ciclo: "MENSAL", periodoInicio: inicio, pagaEm: inicio };

describe("meses iniciados", () => {
  it("o mês em curso conta inteiro", () => {
    expect(mesesIniciados(inicio, inicio)).toBe(0);
    expect(mesesIniciados(inicio, em(1))).toBe(1);
    expect(mesesIniciados(inicio, new Date("2027-02-10T12:00:00Z"))).toBe(1);
    expect(mesesIniciados(inicio, new Date("2027-02-10T12:00:01Z"))).toBe(2);
    expect(mesesIniciados(inicio, em(400))).toBe(12);
  });
  it("dia 31 não acumula desvio", () => {
    const i = new Date("2027-01-31T00:00:00Z");
    expect(mesesIniciados(i, new Date("2027-03-30T00:00:00Z"))).toBe(2);
    expect(mesesIniciados(i, new Date("2027-03-31T00:00:01Z"))).toBe(3);
  });
});

describe("devolução no cancelamento (B1)", () => {
  it("garantia: 1ª assinatura em até 30 dias devolve tudo e encerra o acesso", () => {
    const r = calcularReembolso(anual, { primeiraAssinatura: true, mensalCheio: 297, agora: em(30) });
    expect(r).toMatchObject({ tipo: "GARANTIA", valor: "2970.00", encerraAgora: true });
    expect(calcularReembolso(mensal, { primeiraAssinatura: true, mensalCheio: 297, agora: em(10) }).valor).toBe("297.00");
  });

  it("fora da garantia, o anual devolve o pago menos os meses iniciados a preço mensal cheio (exemplo do parecer: R$ 2.376)", () => {
    const r = calcularReembolso(anual, { primeiraAssinatura: true, mensalCheio: 297, agora: em(45) });
    expect(r).toMatchObject({ tipo: "PROPORCIONAL_ANUAL", valor: "2376.00", mesesUsados: 2, encerraAgora: true });
    expect(r.explicacao).toContain("R$ 2.376,00");
  });

  it("renovação não tem garantia: no 1º mês do anual renovado desconta 1 mês", () => {
    expect(calcularReembolso(anual, { primeiraAssinatura: false, mensalCheio: 297, agora: em(5) }).valor).toBe("2673.00");
  });

  it("anual com o Piloto abatido: o crédito não vira dinheiro", () => {
    const abatido = { ...anual, valor: "1470.00" };
    const r = calcularReembolso(abatido, { primeiraAssinatura: false, mensalCheio: 297, agora: em(200) });
    expect(r).toMatchObject({ tipo: "NENHUM", valor: "0.00", encerraAgora: false });
  });

  it("estorno já feito sai da conta", () => {
    expect(calcularReembolso({ ...anual, valorEstornado: "970.00" }, { primeiraAssinatura: true, mensalCheio: 297, agora: em(3) }).valor).toBe("2000.00");
  });

  it("mensal fora da garantia: nada a devolver, acesso até o fim do mês", () => {
    expect(calcularReembolso(mensal, { primeiraAssinatura: true, mensalCheio: 297, agora: em(31) })).toMatchObject({ tipo: "NENHUM", encerraAgora: false });
  });
});
