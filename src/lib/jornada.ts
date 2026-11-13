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
import type { PlanilhaCustos } from "./calculo/tipos";

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
    texto: "A EC 141/2026 reduz a jornada semanal de 44 para 40 horas, em etapas; em contratos com a administração, a recomposição do preço vem por aditivo de reequilíbrio.",
    fonte: "EC 141/2026, segundo Conjur (24/10/2026); datas a confirmar com o jurídico",
    url: "https://conjur.com.br/2026-out-24/o-fim-da-escala-6x1-e-a-repercussao-nos-contratos-publicos/",
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

/** Planilha nova do cenário: MANTER_HORAS multiplica as linhas em R$ pelo fator; REDUZIR_HORAS copia. */
export function planilhaDoCenario(atual: PlanilhaCustos, cenario: Cenario, antes: number, depois: number): PlanilhaCustos {
  const f = fatorJornada(antes, depois);
  const fonte = cenario === "MANTER_HORAS" ? `EC 141/2026: jornada de ${antes} para ${depois} horas, mantidas as horas de cobertura (× ${f.toDecimalPlaces(4).toString().replace(".", ",")})` : undefined;
  return {
    tipos: atual.tipos.map((t) => ({
      ...t,
      linhas: t.linhas.map((l) =>
        cenario === "MANTER_HORAS" && l.tipo === "VALOR" ? { ...l, valor: new Decimal(l.valor || "0").times(f).toDecimalPlaces(2).toFixed(2), fonte } : { ...l },
      ),
    })),
  };
}

/** Horas de serviço por posto no cenário de redução. */
export function horasReduzidas(horasCobertura: number, antes: number, depois: number): Decimal {
  return new Decimal(horasCobertura).times(depois).div(antes).toDecimalPlaces(2);
}

/** Contrato afetado: mão de obra dedicada, ativo e vigente depois do início da nova jornada. */
export function afetadoPelaJornada(c: { maoDeObraDedicada: boolean; arquivado: boolean; vigenciaFim: Date }, inicio = JORNADA.inicio42()) {
  return c.maoDeObraDedicada && !c.arquivado && c.vigenciaFim >= inicio;
}
