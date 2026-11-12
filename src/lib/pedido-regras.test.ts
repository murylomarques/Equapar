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

import { linhasSemFonte, pendenciasParaGerar } from "./pedido-regras";
import type { PlanilhaCustos } from "./calculo/tipos";

const pl = (salario: string, fonte?: string): PlanilhaCustos => ({
  tipos: [
    {
      id: "t1",
      nome: "Servente",
      quantidade: 1,
      linhas: [
        { id: "l1", modulo: "M1", descricao: "Salário base", tipo: "VALOR", valor: salario, salarioBase: true, fonte },
        { id: "l2", modulo: "M2_1", descricao: "13º salário", tipo: "PERCENTUAL", valor: "8.33", base: "M1" },
      ],
    },
  ],
});

describe("C3: pendências para gerar", () => {
  const base = {
    gatilho: "NOVA_CONVENCAO" as const,
    convencaoId: "c",
    dataBase: new Date(Date.UTC(2026, 0, 1)),
    dataDeposito: new Date(Date.UTC(2026, 1, 10)),
    descricaoGatilho: null,
    dataReferencia: new Date(Date.UTC(2026, 10, 12)),
    checklist: { convencao_nova: "ANEXADO", planilha_atual: "ANEXADO" },
    memoriaAprovadaEm: new Date(),
  };
  it("linha alterada sem fonte é pendência do passo 3; a que varia por consequência não", () => {
    expect(linhasSemFonte(pl("1740"), pl("1800")).map((l) => l.descricao)).toEqual(["Salário base"]);
    const pend = pendenciasParaGerar({ ...base, planilhaAntes: pl("1740") as never, planilhaAgora: pl("1800") as never }, []);
    expect(pend).toEqual([expect.objectContaining({ passo: 3, mensagem: expect.stringContaining("Salário base") })]);
  });
  it("com fonte e aprovado, nada pendente", () => {
    expect(pendenciasParaGerar({ ...base, planilhaAntes: pl("1740") as never, planilhaAgora: pl("1800", "CCT cl. 4ª") as never }, [])).toEqual([]);
  });
  it("sem aumento e sem aprovação: duas pendências, passos 3 e 5; até o passo 3 só a primeira", () => {
    const p = { ...base, memoriaAprovadaEm: null, planilhaAntes: pl("1740") as never, planilhaAgora: pl("1740") as never };
    expect(pendenciasParaGerar(p, []).map((x) => x.passo)).toEqual([3, 5]);
    expect(pendenciasParaGerar(p, [], 3).map((x) => x.passo)).toEqual([3]);
  });
});
