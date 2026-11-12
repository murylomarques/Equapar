import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { aoTrocarPlanilhaAtual, dadosInvalidarAprovacao } from "./pedido-regras";

describe("C1: trocar a planilha atual", () => {
  it("sem planilha nova, não pede confirmação nem mexe em nada", () => {
    const r = aoTrocarPlanilhaAtual({ planilhaAgora: null, passoAtual: 2, memoriaAprovadaEm: null, estado: "EM_ANALISE" });
    expect(r).toEqual({ precisaConfirmar: false, data: {} });
  });

  it("com planilha nova: apaga a nova (DbNull, não undefined), limpa totais, volta ao passo 2 e desfaz a aprovação", () => {
    const r = aoTrocarPlanilhaAtual({ planilhaAgora: { tipos: [] }, passoAtual: 5, memoriaAprovadaEm: new Date(), estado: "CALCULO_VALIDADO" });
    expect(r.precisaConfirmar).toBe(true);
    expect(r.data.planilhaAgora).toBe(Prisma.DbNull);
    expect(r.data).toMatchObject({ diferencaMensal: null, diferencaRetroativa: null, passoAtual: 2, memoriaAprovadaEm: null, memoriaAprovadaPor: null, estado: "EM_ANALISE" });
  });

  it("não avança o passo de quem ainda está no 1 ou 2", () => {
    expect(aoTrocarPlanilhaAtual({ planilhaAgora: {}, passoAtual: 1, memoriaAprovadaEm: null, estado: "EM_ANALISE" }).data.passoAtual).toBe(1);
  });
});

describe("C2: desfazer a aprovação", () => {
  it("sem aprovação e em análise, nada muda", () => {
    expect(dadosInvalidarAprovacao({ memoriaAprovadaEm: null, estado: "EM_ANALISE" })).toEqual({});
  });
  it("pedido gerado volta para em análise e perde a aprovação", () => {
    expect(dadosInvalidarAprovacao({ memoriaAprovadaEm: new Date(), estado: "CALCULO_VALIDADO" })).toEqual({
      memoriaAprovadaEm: null,
      memoriaAprovadaPor: null,
      estado: "EM_ANALISE",
      geradoEm: null,
    });
  });
});
