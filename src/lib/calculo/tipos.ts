/**
 * Planilha de custos e formação de preços — estrutura da IN SEGES/MP 05/2017, Anexo VII-D.
 *
 * REGRA DA EQUAPAR: nenhum valor ou percentual vem pré-definido. O motor só aplica
 * a estrutura (ordem dos módulos e bases de incidência). Todo número é digitado ou
 * confirmado pelo usuário e deve ser revisado por especialista antes do protocolo.
 */

export type ModuloId =
  | "M1" // Composição da remuneração
  | "M2_1" // 13º salário, férias e adicional de férias
  | "M2_2" // GPS, FGTS e outras contribuições
  | "M2_3" // Benefícios mensais e diários
  | "M3" // Provisão para rescisão
  | "M4" // Custo de reposição do profissional ausente
  | "M5" // Insumos diversos
  | "M6_CI" // Custos indiretos
  | "M6_LUCRO" // Lucro
  | "M6_TRIBUTOS"; // Tributos (calculados "por dentro")

/**
 * Bases de incidência de uma linha percentual.
 * - SALARIO_BASE: a linha do Módulo 1 marcada como salário base
 * - M1: total do Módulo 1
 * - M1_M21: Módulo 1 + Submódulo 2.1
 * - M1_M3: Módulos 1 + 2 + 3
 * - SUBTOTAL: Módulos 1 a 5
 * - SUBTOTAL_CI: Módulos 1 a 5 + custos indiretos
 * - POR_DENTRO: tributos sobre o preço final: preço = (subtotal + CI + lucro) ÷ (1 − Σ alíquotas)
 */
export type BaseId = "SALARIO_BASE" | "M1" | "M1_M21" | "M1_M3" | "SUBTOTAL" | "SUBTOTAL_CI" | "POR_DENTRO";

export type TipoLinha = "VALOR" | "PERCENTUAL";

export interface LinhaPlanilha {
  id: string;
  modulo: ModuloId;
  descricao: string;
  tipo: TipoLinha;
  /** Número decimal em texto com ponto ("1820.00", "20.00" para 20%). Negativo permitido (ex.: desconto de vale-transporte). */
  valor: string;
  /** Obrigatória quando tipo = PERCENTUAL */
  base?: BaseId;
  /** Marca a linha de salário base (só no Módulo 1, uma por posto) */
  salarioBase?: boolean;
  /** De onde saiu o número: "CCT 2026, cláusula 4ª, p. 3" */
  fonte?: string;
}

export interface TipoPosto {
  id: string;
  nome: string; // "Servente 44h"
  quantidade: number;
  linhas: LinhaPlanilha[];
}

export interface PlanilhaCustos {
  tipos: TipoPosto[];
}

export interface LinhaCalculada {
  id: string;
  modulo: ModuloId;
  descricao: string;
  valor: string; // R$ por posto, 2 casas
  conta: string; // a conta em palavras
  fonte?: string;
}

export interface PostoCalculado {
  id: string;
  nome: string;
  quantidade: number;
  linhas: LinhaCalculada[];
  totaisModulo: Record<ModuloId, string>;
  valorPorPosto: string;
  valorMensal: string; // valorPorPosto × quantidade
}

export interface ResultadoPlanilha {
  postos: PostoCalculado[];
  valorMensal: string;
  erros: string[];
}

export const MODULOS: { id: ModuloId; nome: string; basePadrao?: BaseId; aceitaValor: boolean }[] = [
  { id: "M1", nome: "Módulo 1 · Composição da remuneração", basePadrao: "SALARIO_BASE", aceitaValor: true },
  { id: "M2_1", nome: "Submódulo 2.1 · 13º salário, férias e adicional de férias", basePadrao: "M1", aceitaValor: true },
  { id: "M2_2", nome: "Submódulo 2.2 · GPS, FGTS e outras contribuições", basePadrao: "M1_M21", aceitaValor: true },
  { id: "M2_3", nome: "Submódulo 2.3 · Benefícios mensais e diários", basePadrao: "SALARIO_BASE", aceitaValor: true },
  { id: "M3", nome: "Módulo 3 · Provisão para rescisão", basePadrao: "M1", aceitaValor: true },
  { id: "M4", nome: "Módulo 4 · Custo de reposição do profissional ausente", basePadrao: "M1_M3", aceitaValor: true },
  { id: "M5", nome: "Módulo 5 · Insumos diversos", aceitaValor: true },
  { id: "M6_CI", nome: "Módulo 6 · Custos indiretos", basePadrao: "SUBTOTAL", aceitaValor: true },
  { id: "M6_LUCRO", nome: "Módulo 6 · Lucro", basePadrao: "SUBTOTAL_CI", aceitaValor: true },
  { id: "M6_TRIBUTOS", nome: "Módulo 6 · Tributos", basePadrao: "POR_DENTRO", aceitaValor: false },
];

export const NOME_BASE: Record<BaseId, string> = {
  SALARIO_BASE: "salário base",
  M1: "Módulo 1",
  M1_M21: "Módulo 1 + Submódulo 2.1",
  M1_M3: "Módulos 1 a 3",
  SUBTOTAL: "Módulos 1 a 5",
  SUBTOTAL_CI: "Módulos 1 a 5 + custos indiretos",
  POR_DENTRO: "preço final (por dentro)",
};

/** Quais bases cada módulo pode usar (só bases já calculadas antes dele). */
export const BASES_PERMITIDAS: Record<ModuloId, BaseId[]> = {
  M1: ["SALARIO_BASE"],
  M2_1: ["SALARIO_BASE", "M1"],
  M2_2: ["SALARIO_BASE", "M1", "M1_M21"],
  M2_3: ["SALARIO_BASE", "M1"],
  M3: ["SALARIO_BASE", "M1", "M1_M21"],
  M4: ["SALARIO_BASE", "M1", "M1_M21", "M1_M3"],
  M5: ["SALARIO_BASE", "M1"],
  M6_CI: ["SUBTOTAL"],
  M6_LUCRO: ["SUBTOTAL", "SUBTOTAL_CI"],
  M6_TRIBUTOS: ["POR_DENTRO"],
};
