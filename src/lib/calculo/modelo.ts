import type { LinhaPlanilha, PlanilhaCustos, TipoPosto } from "./tipos";

let seq = 0;
export function novoId(prefixo = "l") {
  seq = (seq + 1) % 1e6;
  return `${prefixo}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Linhas usuais da IN 05/2017, Anexo VII-D, TODAS com valor 0.
 * Os nomes ajudam a preencher; os números são do usuário (convenção e proposta).
 */
export function linhasModelo(): LinhaPlanilha[] {
  const L = (l: Omit<LinhaPlanilha, "id">): LinhaPlanilha => ({ id: novoId(), ...l });
  return [
    L({ modulo: "M1", descricao: "Salário base", tipo: "VALOR", valor: "0", salarioBase: true }),
    L({ modulo: "M1", descricao: "Adicional de insalubridade", tipo: "VALOR", valor: "0" }),
    L({ modulo: "M1", descricao: "Adicional noturno", tipo: "VALOR", valor: "0" }),
    L({ modulo: "M2_1", descricao: "13º salário", tipo: "PERCENTUAL", base: "M1", valor: "0" }),
    L({ modulo: "M2_1", descricao: "Férias e adicional de férias", tipo: "PERCENTUAL", base: "M1", valor: "0" }),
    L({ modulo: "M2_2", descricao: "INSS", tipo: "PERCENTUAL", base: "M1_M21", valor: "0" }),
    L({ modulo: "M2_2", descricao: "Salário-educação", tipo: "PERCENTUAL", base: "M1_M21", valor: "0" }),
    L({ modulo: "M2_2", descricao: "SAT/RAT ajustado", tipo: "PERCENTUAL", base: "M1_M21", valor: "0" }),
    L({ modulo: "M2_2", descricao: "SESC ou SESI", tipo: "PERCENTUAL", base: "M1_M21", valor: "0" }),
    L({ modulo: "M2_2", descricao: "SENAI ou SENAC", tipo: "PERCENTUAL", base: "M1_M21", valor: "0" }),
    L({ modulo: "M2_2", descricao: "SEBRAE", tipo: "PERCENTUAL", base: "M1_M21", valor: "0" }),
    L({ modulo: "M2_2", descricao: "INCRA", tipo: "PERCENTUAL", base: "M1_M21", valor: "0" }),
    L({ modulo: "M2_2", descricao: "FGTS", tipo: "PERCENTUAL", base: "M1_M21", valor: "0" }),
    L({ modulo: "M2_3", descricao: "Vale-transporte", tipo: "VALOR", valor: "0" }),
    L({ modulo: "M2_3", descricao: "Desconto do vale-transporte (informe negativo)", tipo: "PERCENTUAL", base: "SALARIO_BASE", valor: "0" }),
    L({ modulo: "M2_3", descricao: "Auxílio-alimentação", tipo: "VALOR", valor: "0" }),
    L({ modulo: "M2_3", descricao: "Assistência médica e familiar", tipo: "VALOR", valor: "0" }),
    L({ modulo: "M3", descricao: "Aviso prévio indenizado", tipo: "PERCENTUAL", base: "M1", valor: "0" }),
    L({ modulo: "M3", descricao: "Aviso prévio trabalhado", tipo: "PERCENTUAL", base: "M1", valor: "0" }),
    L({ modulo: "M3", descricao: "Multa do FGTS na rescisão", tipo: "PERCENTUAL", base: "M1", valor: "0" }),
    L({ modulo: "M4", descricao: "Substituto nas ausências legais", tipo: "PERCENTUAL", base: "M1_M3", valor: "0" }),
    L({ modulo: "M4", descricao: "Substituto na intrajornada", tipo: "VALOR", valor: "0" }),
    L({ modulo: "M5", descricao: "Uniformes", tipo: "VALOR", valor: "0" }),
    L({ modulo: "M5", descricao: "Materiais", tipo: "VALOR", valor: "0" }),
    L({ modulo: "M5", descricao: "Equipamentos", tipo: "VALOR", valor: "0" }),
    L({ modulo: "M6_CI", descricao: "Custos indiretos", tipo: "PERCENTUAL", base: "SUBTOTAL", valor: "0" }),
    L({ modulo: "M6_LUCRO", descricao: "Lucro", tipo: "PERCENTUAL", base: "SUBTOTAL_CI", valor: "0" }),
    L({ modulo: "M6_TRIBUTOS", descricao: "PIS", tipo: "PERCENTUAL", base: "POR_DENTRO", valor: "0" }),
    L({ modulo: "M6_TRIBUTOS", descricao: "COFINS", tipo: "PERCENTUAL", base: "POR_DENTRO", valor: "0" }),
    L({ modulo: "M6_TRIBUTOS", descricao: "ISS", tipo: "PERCENTUAL", base: "POR_DENTRO", valor: "0" }),
  ];
}

export function postoModelo(nome = "Servente 44h", quantidade = 1): TipoPosto {
  return { id: novoId("p"), nome, quantidade, linhas: linhasModelo() };
}

export function planilhaModelo(): PlanilhaCustos {
  return { tipos: [postoModelo()] };
}

/** Copia a planilha atual mantendo os ids, para o "Agora" casar linha a linha com o "Antes". */
export function clonarPlanilha(p: PlanilhaCustos): PlanilhaCustos {
  return JSON.parse(JSON.stringify(p));
}
