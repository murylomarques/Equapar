/**
 * Fase 2 (5.1). Pedido "Jornada de 40 horas" (EC 141/2026).
 *
 * DATAS E PRAZOS: ficam em configuração e estão marcados "a confirmar com o jurídico". As fontes públicas
 * divergem; o dono confirma com o advogado (item 2 da seção 8). Padrões tirados das fontes citadas abaixo.
 *
 * CÁLCULO (regra nova, só para este gatilho, com escolha explícita de cenário em cada pedido; nenhum é padrão):
 * - MANTER_HORAS: o órgão continua recebendo as mesmas horas de cobertura. Empregados por posto =
 *   horas de cobertura ÷ jornada. O custo do posto sobe na proporção jornada antes ÷ jornada depois
 *   (44 ÷ 40 = 1,10). Na planilha, as linhas em R$ são multiplicadas por esse fator; as linhas em % e os
 *   tributos acompanham pelo próprio motor (todas dependem das linhas em R$).
 * - REDUZIR_HORAS: o valor por empregado continua o mesmo; o órgão recebe menos horas
 *   (cobertura × jornada depois ÷ jornada antes). A planilha nova é igual à atual e o documento registra a redução.
 */
import Decimal from "decimal.js";
import type { LinhaPlanilha, PlanilhaCustos } from "./calculo/tipos";

export type Cenario = "MANTER_HORAS" | "REDUZIR_HORAS";

const data = (v: string | undefined, padrao: string) => new Date(`${v || padrao}T00:00:00Z`);

export const JORNADA = {
  /** Início das 42 horas semanais. A confirmar com o jurídico. */
  inicio42: () => data(process.env.JORNADA_42H_INICIO, "2026-12-16"),
  /** Início das 40 horas semanais. A confirmar com o jurídico. */
  inicio40: () => data(process.env.JORNADA_40H_INICIO, "2027-12-16"),
  /** Prazo para o aditivo de reequilíbrio. A confirmar com o jurídico. */
  prazoAditivo: () => data(process.env.JORNADA_ADITIVO_PRAZO, "2027-10-16"),
  confirmado: () => process.env.JORNADA_REGRA_CONFIRMADA === "true",
  fonte: {
    texto: "A Emenda Constitucional 141/2026 reduz a jornada semanal de 44 para 40 horas, em duas etapas (42 horas, depois 40). Nos contratos públicos com mão de obra, o equilíbrio econômico-financeiro é preservado por termo aditivo.",
    fonte: "Emenda Constitucional 141/2026 (Planalto)",
    url: "https://planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc141.htm",
  },
};

/** Fator de custo do posto ao manter as horas de cobertura: jornada antes ÷ jornada depois. */
export function fatorJornada(antes: number, depois: number): Decimal {
  if (!(antes > 0) || !(depois > 0) || depois > antes) throw new Error("Jornada inválida: a nova jornada precisa ser menor que a atual.");
  return new Decimal(antes).div(depois);
}

/** Empregados por posto para cobrir as horas exigidas. */
export function empregadosPorPosto(horasCobertura: number, jornada: number): Decimal {
  return new Decimal(horasCobertura).div(jornada).toDecimalPlaces(4);
}

/** D2: fator com 6 casas, só para mostrar (o cálculo usa o fator exato, sem arredondar). */
export function fatorTexto(antes: number, depois: number) {
  return fatorJornada(antes, depois).toFixed(6).replace(".", ",");
}

/**
 * D2: a linha acompanha o número de empregados? Padrão: sim nos módulos 1 a 4 (remuneração, encargos,
 * benefícios, rescisão, reposição); não nos materiais e equipamentos do módulo 5, exceto uniformes (sim,
 * editável). Linhas em percentual acompanham pelo próprio motor (dependem das linhas em R$).
 */
export function acompanhaPadrao(l: Pick<LinhaPlanilha, "modulo" | "descricao">) {
  if (l.modulo === "M5") return /uniform/i.test(l.descricao ?? "");
  return ["M1", "M2_1", "M2_2", "M2_3", "M3", "M4"].includes(l.modulo);
}
export function acompanha(l: LinhaPlanilha) {
  return l.acompanhaEmpregados ?? acompanhaPadrao(l);
}

const brlTxt = (v: Decimal) => `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

/**
 * Planilha nova do cenário. D2: o salário e os demais valores por empregado ficam no valor da convenção; o
 * aumento entra como EMPREGADOS EQUIVALENTES por posto (jornada anterior ÷ nova), só nas linhas que
 * acompanham o número de empregados. A linha guarda o custo por posto e a fonte mostra a conta:
 * "R$ 1.820,00 × 1,047619 empregados equivalentes = R$ 1.906,67 por posto". REDUZIR_HORAS: valores iguais
 * (art. 2º da EC 141); o documento registra a redução das horas entregues.
 */
export function planilhaDoCenario(atual: PlanilhaCustos, cenario: Cenario, antes: number, depois: number): PlanilhaCustos {
  const f = fatorJornada(antes, depois);
  return {
    tipos: atual.tipos.map((t) => ({
      ...t,
      linhas: t.linhas.map((l) => {
        if (cenario !== "MANTER_HORAS" || l.tipo !== "VALOR" || !acompanha(l)) return { ...l };
        const base = new Decimal(l.valor || "0");
        const porPosto = base.times(f).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        return {
          ...l,
          valor: porPosto.toFixed(2),
          fonte: `${brlTxt(base)} × ${fatorTexto(antes, depois)} empregados equivalentes = ${brlTxt(porPosto)} por posto (EC 141/2026, jornada ${antes} para ${depois} h)`,
        };
      }),
    })),
  };
}

/** D2: redução das horas entregues no cenário REDUZIR_HORAS, em % (44 → 42: 4,545%). */
export function reducaoHorasPct(antes: number, depois: number) {
  return new Decimal(antes - depois).div(antes).times(100).toDecimalPlaces(3);
}

/** D3: as etapas da EC 141 e a data em que cada uma vale. Pedido de 44 para 40 h num só aditivo fica fora. */
export function etapasJornada() {
  return [
    { id: "44-42" as const, antes: 44, depois: 42, inicio: JORNADA.inicio42(), fim: JORNADA.inicio40() },
    { id: "42-40" as const, antes: 42, depois: 40, inicio: JORNADA.inicio40(), fim: null as Date | null },
  ];
}
export type EtapaId = "44-42" | "42-40";

/** D3: a etapa vigente na data (início dos efeitos). Antes do início das 42 h, nenhuma. */
export function etapaNaData(d: Date) {
  return etapasJornada().find((e) => d >= e.inicio && (!e.fim || d < e.fim)) ?? null;
}

/** Horas de serviço por posto no cenário de redução. */
export function horasReduzidas(horasCobertura: number, antes: number, depois: number): Decimal {
  return new Decimal(horasCobertura).times(depois).div(antes).toDecimalPlaces(2);
}

/** Contrato afetado: mão de obra dedicada, ativo e vigente depois do início da nova jornada. */
export function afetadoPelaJornada(c: { maoDeObraDedicada: boolean; arquivado: boolean; vigenciaFim: Date }, inicio = JORNADA.inicio42()) {
  return c.maoDeObraDedicada && !c.arquivado && c.vigenciaFim >= inicio;
}
