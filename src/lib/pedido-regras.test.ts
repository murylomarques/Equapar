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
      memoriaVersaoAprovadaId: null,
      estado: "EM_ANALISE",
      geradoEm: null,
    });
  });
});

import { linhasSemFonte, pendenciasParaGerar } from "./pedido-regras";
import type { PlanilhaCustos } from "./calculo/tipos";

const pl = (salario: string, fonte?: string, anualidade: "VALIDA" | "NAO_SE_APLICA" | null = "VALIDA", motivo?: string): PlanilhaCustos => ({
  tipos: [
    {
      id: "t1",
      nome: "Servente",
      quantidade: 1,
      linhas: [
        {
          id: "l1",
          modulo: "M1",
          descricao: "Salário base",
          tipo: "VALOR",
          valor: salario,
          salarioBase: true,
          fonte,
          evidencia: fonte ? { instrumento: "CCT 2026", categoria: "Servente", dataBase: "2026-01-01", clausula: "4ª", parcela: "salário normativo", anualidade: anualidade ?? undefined, motivoRevisao: motivo } : undefined,
        },
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
    // sem fonte nenhuma: falta a evidência e falta a resposta da anualidade (nada vem marcado)
    expect(pend).toEqual([
      expect.objectContaining({ passo: 3, mensagem: expect.stringContaining("fonte") }),
      expect.objectContaining({ passo: 3, mensagem: expect.stringContaining("anualidade") }),
    ]);
  });
  it("com fonte, anualidade respondida e aprovado, nada pendente", () => {
    expect(pendenciasParaGerar({ ...base, planilhaAntes: pl("1740") as never, planilhaAgora: pl("1800", "CCT cl. 4ª") as never }, [])).toEqual([]);
  });
  it("anualidade não respondida é pendência; 'não se aplica' exige motivo", () => {
    const semResposta = pendenciasParaGerar({ ...base, planilhaAntes: pl("1740") as never, planilhaAgora: pl("1800", "CCT", null) as never }, []);
    expect(semResposta.map((x) => x.mensagem).join(" ")).toMatch(/Responda a anualidade de: Salário base/);
    const semMotivo = pendenciasParaGerar({ ...base, planilhaAntes: pl("1740") as never, planilhaAgora: pl("1800", "CCT", "NAO_SE_APLICA") as never }, []);
    expect(semMotivo).toHaveLength(1);
    const comMotivo = pendenciasParaGerar({ ...base, planilhaAntes: pl("1740") as never, planilhaAgora: pl("1800", "CCT", "NAO_SE_APLICA", "alteração legal de alíquota") as never }, []);
    expect(comMotivo).toEqual([]);
  });
  it("sem aumento e sem aprovação: duas pendências, passos 3 e 5; até o passo 3 só a primeira", () => {
    const p = { ...base, memoriaAprovadaEm: null, planilhaAntes: pl("1740") as never, planilhaAgora: pl("1740") as never };
    expect(pendenciasParaGerar(p, []).map((x) => x.passo)).toEqual([3, 5]);
    expect(pendenciasParaGerar(p, [], 3).map((x) => x.passo)).toEqual([3]);
  });
});

import { aprovacaoValida, hashCalculo } from "./pedido-regras";

describe("C2.3: assinatura da base do cálculo", () => {
  const p = {
    planilhaAntes: pl("1740") as never,
    planilhaAgora: pl("1800", "cl. 4ª") as never,
    dataBase: new Date(Date.UTC(2026, 0, 1)),
    dataReferencia: new Date(Date.UTC(2026, 10, 12)),
    gatilho: "NOVA_CONVENCAO" as const,
  };
  it("é estável e não depende da ordem das chaves", () => {
    const reordenado = { gatilho: p.gatilho, dataReferencia: p.dataReferencia, dataBase: p.dataBase, planilhaAgora: p.planilhaAgora, planilhaAntes: p.planilhaAntes };
    expect(hashCalculo(reordenado)).toBe(hashCalculo(p));
  });
  it("aprovação vale só enquanto a base é a mesma", () => {
    const aprovado = { ...p, memoriaAprovadaEm: new Date(), hashCalculo: hashCalculo(p) };
    expect(aprovacaoValida(aprovado)).toBe(true);
    expect(aprovacaoValida({ ...aprovado, dataBase: new Date(Date.UTC(2026, 5, 1)) })).toBe(false);
    expect(aprovacaoValida({ ...aprovado, planilhaAgora: pl("1900", "cl. 4ª") as never })).toBe(false);
    expect(aprovacaoValida({ ...aprovado, memoriaAprovadaEm: null })).toBe(false);
    expect(aprovacaoValida({ ...aprovado, hashCalculo: null })).toBe(true); // aprovação anterior à assinatura
  });
  it("invalida a aprovação quando o protocolo ou apostilamento define o corte efetivo", () => {
    const protocolo = { ...p, retroContarAte: "DATA_PROTOCOLO" as const };
    expect(hashCalculo({ ...protocolo, protocoloData: new Date(Date.UTC(2026, 10, 13)) } as never)).not.toBe(hashCalculo(protocolo as never));
    const apostila = { ...p, retroContarAte: "DATA_APOSTILAMENTO" as const };
    expect(hashCalculo({ ...apostila, apostiladoEm: new Date(Date.UTC(2026, 10, 14)) } as never)).not.toBe(hashCalculo(apostila as never));
  });
});
