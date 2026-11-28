/**
 * Pedido "Jornada" (EC 141/2026). Regras do parecer do advogado de 28/11/2026 (data-base legislativa 28/11/2026).
 *
 * NORMAS: EC 141/2026 (arts. 9º e 10), medida cautelar do STF nas ADIs 8041 e 8042 (item VII), Decreto 13.173/2026,
 * Portaria MTE 2.041/2026 (retificada em 25/11/2026) e Lei 14.133/2021 (arts. 124, 131, 134, 135 e 136).
 * A cautelar é provisória (a AGU pediu que não seja referendada): as datas ficam em configuração (JORNADA_*).
 *
 * A1. Prazo para o aditivo, pelo enquadramento do contrato (não existe prazo universal):
 *  - vigente na publicação da EC (16/10/2026): até 14/04/2027 (cautelar) ou 16/10/2027 (prazo original da EC);
 *  - decorrente de licitação em andamento em 16/10/2026: 180 dias da assinatura do contrato;
 *  - sem regime de transição: cronograma geral (42 h em 16/12/2026; 40 h em 16/12/2027).
 * A2. Início da jornada no contrato (efeitos pleiteados): aditivo até 16/12/2026 → 16/12/2026; aditivo depois, dentro
 *  do prazo → data do aditivo; sem aditivo → fim do prazo; sem transição → cronograma geral. Nunca antes das datas gerais.
 *  O pedido guarda separadas as datas de exigibilidade, alteração dos custos, protocolo, aditivo, efeitos pleiteados e
 *  efeitos reconhecidos pela Administração.
 * A3. O segundo repouso semanal vale desde 16/12/2026 (regra preventiva) e é tratado à parte da redução da jornada; o
 *  valor do repouso já incorporado ao salário mensal não é duplicado (Portaria MTE 2.041/2026, art. 11).
 * A4. 44/42 e 44/40 são referência matemática, não teto nem aumento automático. Cálculo por tipo de posto, com o
 *  dimensionamento real informado pela empresa; vale-transporte e alimentação pelos dias trabalhados; 12x36 com
 *  apuração própria (média mensal acima do limite: horas extras ou compensação, pelo instrumento coletivo).
 *  Diferença = novo custo − custo vigente: pode ser positiva, negativa ou zero.
 * A5. Instrumento: termo aditivo (não apostila); não se confunde com a repactuação ordinária nem exige anualidade.
 */
import Decimal from "decimal.js";
import type { JornadaDoPosto, LinhaPlanilha, PlanilhaCustos, TipoPosto } from "./calculo/tipos";

export type Cenario = "MANTER_HORAS" | "REDUZIR_HORAS" | "REORGANIZAR_ESCALAS";
export const NOME_CENARIO: Record<Cenario, string> = {
  MANTER_HORAS: "Manter a cobertura operacional",
  REDUZIR_HORAS: "Reduzir as horas de cobertura",
  REORGANIZAR_ESCALAS: "Reorganizar as escalas",
};

export type Enquadramento = "VIGENTE_NA_EC" | "LICITACAO_EM_ANDAMENTO" | "SEM_TRANSICAO";
export const NOME_ENQUADRAMENTO: Record<Enquadramento, string> = {
  VIGENTE_NA_EC: "Contrato vigente na publicação da EC (16/10/2026)",
  LICITACAO_EM_ANDAMENTO: "Contrato de licitação que estava em andamento em 16/10/2026",
  SEM_TRANSICAO: "Contrato sem regime de transição",
};

/** Versão da metodologia de cálculo da jornada; vai para o pedido e para os documentos (D: versionamento). */
export const METODOLOGIA_JORNADA_VERSAO = "jornada-2026-11-28";

export const NORMAS_JORNADA = [
  { nome: "Emenda Constitucional nº 141/2026, arts. 9º e 10", url: "https://planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc141.htm" },
  { nome: "STF, medida cautelar nas ADIs 8041 e 8042 (12/11/2026), item VII", url: "https://portal.stf.jus.br/" },
  { nome: "Decreto nº 13.173, de 19/11/2026", url: "https://www.planalto.gov.br/" },
  { nome: "Portaria MTE nº 2.041, de 19/11/2026 (retificada em 25/11/2026)", url: "https://www.gov.br/trabalho-e-emprego/" },
  { nome: "Lei nº 14.133/2021, arts. 124, 131, 134, 135 e 136", url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm" },
] as const;

const data = (v: string | undefined, padrao: string) => new Date(`${v || padrao}T00:00:00Z`);
const DIA = 86_400_000;

export const JORNADA = {
  /** Publicação da EC 141/2026 (DOU). */
  publicacaoEc: () => data(process.env.JORNADA_EC_PUBLICACAO, "2026-10-16"),
  /** Início geral das 42 horas semanais (e do segundo repouso). */
  inicio42: () => data(process.env.JORNADA_42H_INICIO, "2026-12-16"),
  /** Início geral das 40 horas semanais. */
  inicio40: () => data(process.env.JORNADA_40H_INICIO, "2027-12-16"),
  /** A cautelar do STF continua valendo? JORNADA_LIMINAR_VIGENTE=false volta ao prazo original da EC. */
  liminarVigente: () => process.env.JORNADA_LIMINAR_VIGENTE !== "false",
  /** Prazo do aditivo dos contratos vigentes na publicação da EC: 14/04/2027 (cautelar) ou 16/10/2027 (original). */
  prazoAditivo: () => (JORNADA.liminarVigente() ? data(process.env.JORNADA_ADITIVO_PRAZO, "2027-04-14") : data(process.env.JORNADA_PRAZO_ORIGINAL, "2027-10-16")),
  /** Contrato de licitação em andamento: dias contados da assinatura (cautelar, item VII). */
  diasLicitacao: () => {
    const n = Number(process.env.JORNADA_DIAS_LICITACAO);
    return Number.isInteger(n) && n > 0 && n <= 730 ? n : 180;
  },
  /** Chave mestra: com ela desligada, só a equipe vê a jornada (com a marca de simulação). */
  confirmado: () => process.env.JORNADA_REGRA_CONFIRMADA === "true",
  fonte: {
    texto: "A Emenda Constitucional 141/2026 reduz a jornada semanal de 44 para 40 horas, em duas etapas (42 horas, depois 40). Nos contratos públicos com mão de obra, a adaptação é feita por termo aditivo.",
    fonte: "Emenda Constitucional 141/2026 (Planalto)",
    url: "https://planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc141.htm",
  },
};

// ---------------------------------------------------------------------------
// A1 e A2: enquadramento, prazo do aditivo e início da jornada no contrato
// ---------------------------------------------------------------------------

/** Sugestão pelo início do contrato: assinado até a publicação da EC = vigente. Depois disso, a empresa informa. */
export function enquadramentoSugerido(assinatura: Date | null | undefined): Enquadramento | null {
  if (assinatura && assinatura <= JORNADA.publicacaoEc()) return "VIGENTE_NA_EC";
  return null;
}

/** A1: prazo para formalizar o aditivo; null = sem regime de transição (vale o cronograma geral). */
export function prazoAditivoDoContrato(enq: Enquadramento, assinatura?: Date | null): Date | null {
  if (enq === "VIGENTE_NA_EC") return JORNADA.prazoAditivo();
  if (enq === "LICITACAO_EM_ANDAMENTO") return assinatura ? new Date(assinatura.getTime() + JORNADA.diasLicitacao() * DIA) : null;
  return null;
}

/**
 * A2: quando a jornada da etapa passa a valer no contrato (os efeitos pleiteados por padrão).
 * Etapa 42 → 40: cronograma geral. Etapa 44 → 42: pela tabela do parecer, nunca antes de 16/12/2026.
 */
export function inicioNoContrato(etapa: EtapaId, enq: Enquadramento, o: { dataAditivo?: Date | null; assinatura?: Date | null } = {}): Date {
  const geral = etapa === "42-40" ? JORNADA.inicio40() : JORNADA.inicio42();
  if (etapa === "42-40" || enq === "SEM_TRANSICAO") return geral;
  const prazo = prazoAditivoDoContrato(enq, o.assinatura);
  let d: Date;
  if (o.dataAditivo) d = o.dataAditivo <= geral ? geral : prazo && o.dataAditivo > prazo ? prazo : o.dataAditivo;
  else d = prazo ?? geral;
  return d < geral ? geral : d;
}

/** Explicação curta da regra aplicada (vai para a tela e para a fundamentação). */
export function explicarInicio(etapa: EtapaId, enq: Enquadramento, o: { dataAditivo?: Date | null; assinatura?: Date | null } = {}): string {
  const br = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  if (etapa === "42-40") return `Etapa de 40 horas: cronograma constitucional geral (${br(JORNADA.inicio40())}).`;
  if (enq === "SEM_TRANSICAO") return `Sem regime de transição: cronograma constitucional geral (${br(JORNADA.inicio42())}).`;
  const prazo = prazoAditivoDoContrato(enq, o.assinatura);
  if (!prazo) return "Informe a data de assinatura do contrato para calcular o prazo de 180 dias.";
  if (!o.dataAditivo) return `Sem aditivo formalizado: a jornada passa a valer no fim do prazo de transição (${br(prazo)}).`;
  if (o.dataAditivo <= JORNADA.inicio42()) return `Aditivo formalizado até ${br(JORNADA.inicio42())}: vale a data geral (${br(JORNADA.inicio42())}).`;
  if (o.dataAditivo > prazo) return `Aditivo depois do fim do prazo (${br(prazo)}): a jornada vale desde o fim do prazo.`;
  return `Aditivo formalizado dentro do prazo de transição: a jornada vale desde a data do aditivo (${br(o.dataAditivo)}).`;
}

// ---------------------------------------------------------------------------
// A4: cálculo por tipo de posto
// ---------------------------------------------------------------------------

/** Fator matemático de referência (não é teto nem aumento automático): jornada antes ÷ jornada depois. */
export function fatorJornada(antes: number, depois: number): Decimal {
  if (!(antes > 0) || !(depois > 0) || depois > antes) throw new Error("Jornada inválida: a nova jornada precisa ser menor que a atual.");
  return new Decimal(antes).div(depois);
}

/** Variação teórica do valor da hora (44 → 42: 4,7619%; 44 → 40: 10%). */
export function variacaoHoraPct(antes: number, depois: number) {
  return fatorJornada(antes, depois).minus(1).times(100).toDecimalPlaces(4);
}

/** Divisor mensal de referência do salário-hora: 44 h = 220, 42 h = 210, 40 h = 200 (Decreto 13.173/2026). */
export function divisorMensal(semanal: number) {
  return semanal * 5;
}

/** Empregados por posto para cobrir as horas exigidas. */
export function empregadosPorPosto(horasCobertura: number, jornada: number): Decimal {
  return new Decimal(horasCobertura).div(jornada).toDecimalPlaces(4);
}

/** Fator com 6 casas, só para mostrar (o cálculo usa o fator exato, sem arredondar). */
export function fatorTexto(antes: number, depois: number) {
  return fatorJornada(antes, depois).toFixed(6).replace(".", ",");
}

/** A linha acompanha o número de empregados? Módulos 1 a 4, sim; módulo 5, só uniformes (editável). */
export function acompanhaPadrao(l: Pick<LinhaPlanilha, "modulo" | "descricao">) {
  if (l.modulo === "M5") return /uniform|epi\b|equipamento de prote/i.test(l.descricao ?? "");
  return ["M1", "M2_1", "M2_2", "M2_3", "M3", "M4"].includes(l.modulo);
}
export function acompanha(l: LinhaPlanilha) {
  return l.acompanhaEmpregados ?? acompanhaPadrao(l);
}

/** Vale-transporte e alimentação/refeição: dependem dos dias trabalhados (A4). Cesta mensal fixa não. */
export function porDiaTrabalhado(l: Pick<LinhaPlanilha, "modulo" | "descricao">) {
  return l.modulo === "M2_3" && /transporte|alimenta|refei/i.test(l.descricao ?? "") && !/cesta/i.test(l.descricao ?? "");
}

export type Tratamento = "ADEQUAR" | "MANTER" | "APURAR_12X36";

/** Tabela do parecer (A4): o que acontece com o posto na etapa. */
export function tratamentoDoPosto(j: JornadaDoPosto | undefined, antes: number, depois: number): { tratamento: Tratamento; semanal: number } {
  if (j?.escala12x36) return { tratamento: "APURAR_12X36", semanal: 42 };
  const semanal = j?.semanal && j.semanal > 0 ? j.semanal : antes;
  return { tratamento: semanal > depois ? "ADEQUAR" : "MANTER", semanal };
}

/** Média semanal da escala 12x36 (12 h a cada 48 h): 42 horas. */
export const MEDIA_SEMANAL_12X36 = 42;

/** 12x36: horas mensais acima do limite semanal (média do mês: semanas de 52/12). */
export function horasExcedentes12x36(limite: number): Decimal {
  return Decimal.max(0, new Decimal(MEDIA_SEMANAL_12X36).minus(limite)).times(52).div(12);
}

const brlTxt = (v: Decimal) => `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
const num = (v: Decimal, casas = 4) => v.toDecimalPlaces(casas).toString().replace(".", ",");

/** Fator de empregados do posto no cenário: o informado pela empresa ou, sem ele, a proporção das jornadas. */
export function fatorEmpregados(t: Pick<TipoPosto, "jornada">, antes: number, depois: number): { fator: Decimal; informado: boolean } {
  const j = t.jornada;
  if (j?.empregadosAntes && j.empregadosAntes > 0 && j.empregadosDepois && j.empregadosDepois > 0)
    return { fator: new Decimal(j.empregadosDepois).div(j.empregadosAntes), informado: true };
  const { tratamento, semanal } = tratamentoDoPosto(j, antes, depois);
  return { fator: tratamento === "ADEQUAR" ? fatorJornada(semanal, depois) : new Decimal(1), informado: false };
}

/** Pendências do cenário: reorganizar as escalas exige o dimensionamento informado em cada posto. */
export function pendenciasDoCenario(atual: PlanilhaCustos, cenario: Cenario): string[] {
  if (cenario !== "REORGANIZAR_ESCALAS") return [];
  return atual.tipos
    .filter((t) => !(t.jornada?.empregadosAntes && t.jornada.empregadosAntes > 0 && t.jornada?.empregadosDepois && t.jornada.empregadosDepois > 0))
    .map((t) => `Informe os empregados por posto, hoje e depois, em ${t.nome}.`);
}

/**
 * Planilha nova do cenário (A4). Reduzir as horas: valores iguais (proposta a negociar; o documento registra a redução).
 * Manter a cobertura ou reorganizar as escalas, em cada posto:
 *  - linhas em R$ que acompanham o número de empregados × fator de empregados (informado, ou a proporção das jornadas);
 *  - vale-transporte e alimentação × também a razão dos dias trabalhados, se a empresa informou;
 *  - 12x36: o salário não muda; entra a linha das horas excedentes (divisor e adicional), salvo compensação;
 *  - salário mensal preservado; o segundo repouso não é somado de novo (já está no salário mensal).
 * As linhas em % e os tributos acompanham pelo próprio motor.
 */
export function planilhaDoCenario(atual: PlanilhaCustos, cenario: Cenario, antes: number, depois: number): PlanilhaCustos {
  if (cenario === "REDUZIR_HORAS") return { tipos: atual.tipos.map((t) => ({ ...t, linhas: t.linhas.map((l) => ({ ...l })) })) };
  return {
    tipos: atual.tipos.map((t) => {
      const j = t.jornada;
      const { tratamento } = tratamentoDoPosto(j, antes, depois);
      const { fator, informado } = fatorEmpregados(t, antes, depois);
      const dias = j?.diasAntes && j.diasAntes > 0 && j?.diasDepois && j.diasDepois > 0 ? new Decimal(j.diasDepois).div(j.diasAntes) : null;
      const fatorTxt = fator.toFixed(6).replace(".", ",");
      const motivo = informado
        ? `${fatorTxt} (${num(new Decimal(j!.empregadosAntes!))} → ${num(new Decimal(j!.empregadosDepois!))} empregados por posto, informados pela empresa)`
        : `${fatorTxt} empregados equivalentes`;
      const linhas: LinhaPlanilha[] = t.linhas.map((l) => {
        if (l.tipo !== "VALOR" || !acompanha(l)) return { ...l };
        const f = porDiaTrabalhado(l) && dias ? fator.times(dias) : fator;
        if (f.eq(1)) return { ...l };
        const base = new Decimal(l.valor || "0");
        const porPosto = base.times(f).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const contaDias = porDiaTrabalhado(l) && dias ? ` × ${j!.diasDepois}/${j!.diasAntes} dias trabalhados` : "";
        return {
          ...l,
          valor: porPosto.toFixed(2),
          fonte: `${brlTxt(base)} × ${motivo}${contaDias} = ${brlTxt(porPosto)} por posto (EC 141/2026, jornada ${antes} para ${depois} h)`,
        };
      });
      if (tratamento === "APURAR_12X36" && !j?.compensar12x36) {
        const horas = horasExcedentes12x36(depois);
        const salario = t.linhas.find((l) => l.salarioBase && l.tipo === "VALOR");
        if (horas.gt(0) && salario) {
          const divisor = j?.divisor && j.divisor > 0 ? j.divisor : divisorMensal(depois);
          const adicional = j?.adicionalHePct != null && j.adicionalHePct >= 0 ? j.adicionalHePct : 50;
          const empregados = new Decimal(j?.empregadosDepois && j.empregadosDepois > 0 ? j.empregadosDepois : 1);
          const hora = new Decimal(salario.valor || "0").div(divisor);
          const valor = hora.times(1 + adicional / 100).times(horas).times(empregados).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          linhas.push({
            id: "jornada-he-12x36",
            modulo: "M1",
            descricao: "Horas excedentes da escala 12x36 (média acima do limite semanal)",
            tipo: "VALOR",
            valor: valor.toFixed(2),
            fonte: `12x36: média de ${MEDIA_SEMANAL_12X36} h/semana, limite de ${depois} h = ${num(horas, 2)} h/mês × salário-hora ${brlTxt(hora)} (divisor ${divisor}) × ${100 + adicional}% × ${num(empregados)} empregado(s) = ${brlTxt(valor)} (Decreto 13.173/2026; instrumento coletivo)`,
          });
        }
      }
      return { ...t, linhas };
    }),
  };
}

/** Redução das horas entregues no cenário REDUZIR_HORAS, em % (44 → 42: 4,545%). */
export function reducaoHorasPct(antes: number, depois: number) {
  return new Decimal(antes - depois).div(antes).times(100).toDecimalPlaces(3);
}

/** As etapas da EC 141 e a data geral em que cada uma vale. Pedido de 44 para 40 h num só aditivo fica fora. */
export function etapasJornada() {
  return [
    { id: "44-42" as const, antes: 44, depois: 42, inicio: JORNADA.inicio42(), fim: JORNADA.inicio40() },
    { id: "42-40" as const, antes: 42, depois: 40, inicio: JORNADA.inicio40(), fim: null as Date | null },
  ];
}
export type EtapaId = "44-42" | "42-40";

/** A etapa vigente na data. Antes do início das 42 h, nenhuma. */
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
