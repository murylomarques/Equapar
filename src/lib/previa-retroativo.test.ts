import { describe, expect, it } from "vitest";
import { antes, agora } from "../../prisma/seed-demo";
import { compararPlanilhas } from "./calculo/motor";
import { calcularPedido } from "./pedido";
import { lerCompetenciasRetroativo, opcoesDoFormulario, previaRetroativo, type OpcoesRetroativo } from "./previa-retroativo";

// Prévia do passo 3 = resultado oficial (passo 5, memória e documentos), também com opções fora do padrão.
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const diferenca = compararPlanilhas(antes, agora).diferencaMensal;
const gravadas: OpcoesRetroativo = {
  retroContarAte: "DATA_INFORMADA",
  retroMesIncompleto: "DIAS_CORRIDOS",
  retroCompararMes: false,
  valoresJaPagos: null,
  retroativoCompetencias: [],
  protocoloData: null,
  apostiladoEm: null,
  gatilho: "NOVA_CONVENCAO",
  jornadaInicioEfeitos: null,
};
const form = (campos: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
};

describe("prévia do retroativo no passo 3", () => {
  it("padrão: o mesmo R$ 33.951,94 do caso de exemplo", () => {
    expect(previaRetroativo(gravadas, diferenca, "2026-01-01", "2026-11-12").retroativo?.total).toBe("33951.94");
  });

  it("mês de 30 dias, contar até o protocolo e valores já pagos: igual ao cálculo oficial (e diferente da conta por dias corridos)", () => {
    const { opcoes, erro } = opcoesDoFormulario(
      { ...gravadas, protocoloData: "2026-10-20" },
      form({ retroContarAte: "DATA_PROTOCOLO", retroMesIncompleto: "MES_30_DIAS", valoresJaPagos: "1.500,00", retroativoCompetencias: "[]" }),
    );
    expect(erro).toBeUndefined();
    const previa = previaRetroativo(opcoes, diferenca, "2026-01-01", "2026-11-12");
    const oficial = calcularPedido({
      planilhaAntes: antes as never,
      planilhaAgora: agora as never,
      dataBase: d("2026-01-01"),
      dataReferencia: d("2026-11-12"),
      retroContarAte: "DATA_PROTOCOLO",
      retroMesIncompleto: "MES_30_DIAS",
      protocoloData: d("2026-10-20"),
      valoresJaPagos: "1500.00" as never,
    });
    expect(previa.retroativo).toEqual(oficial.retroativo);
    expect(previa.retroativoBruto).toBe(oficial.retroativoBruto);
    expect(previa.jaPago).toBe("1500.00");
    expect(previa.dataReferencia).toEqual(d("2026-10-20"));
    expect(previa.regraRetroativo).toBe(oficial.regraRetroativo);
    expect(previa.retroativo?.total).not.toBe("33951.94");
  });

  it("competências separadas substituem a conta automática, como no cálculo oficial", () => {
    const comps = [
      { competencia: "2026-01", diferencaMensal: "1.000,00", dias: 31, divisor: 31 },
      { competencia: "2026-02", diferencaMensal: "1200", dias: 14, divisor: 28, base: "CCT 2026" },
    ];
    const { opcoes } = opcoesDoFormulario(gravadas, form({ retroativoCompetencias: JSON.stringify(comps) }));
    const previa = previaRetroativo(opcoes, diferenca, "2026-01-01", "2026-11-12");
    const oficial = calcularPedido({
      planilhaAntes: antes as never,
      planilhaAgora: agora as never,
      dataBase: d("2026-01-01"),
      dataReferencia: d("2026-11-12"),
      retroativoCompetencias: lerCompetenciasRetroativo(JSON.stringify(comps)) as never,
    });
    expect(previa.retroativo?.total).toBe("1600.00");
    expect(previa.retroativo).toEqual(oficial.retroativo);
  });

  it("campo inválido no formulário vira aviso (o servidor recusaria o passo)", () => {
    expect(opcoesDoFormulario(gravadas, form({ valoresJaPagos: "abc" })).erro).toBe("Confira os valores já pagos.");
    expect(opcoesDoFormulario(gravadas, form({ retroativoCompetencias: '[{"competencia":"2026-01","diferencaMensal":""}]' })).erro).toBe("Confira as competências do retroativo.");
    const sobreposta = opcoesDoFormulario(gravadas, form({ retroativoCompetencias: JSON.stringify([{ competencia: "2026-01", diferencaMensal: "1", dias: 1, divisor: 30 }, { competencia: "2026-01", diferencaMensal: "1", dias: 1, divisor: 30 }]) }));
    expect(previaRetroativo(sobreposta.opcoes, diferenca, "2026-01-01", "2026-11-12").pendenciaRetroativo).toMatch(/sobreposta/);
  });
});
