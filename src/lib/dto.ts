import type { Contrato, Convencao } from "@prisma/client";
import { MESES, paraInputData } from "./format";
import type { ContratoForm } from "@/app/app/contratos/form-contrato";

/** Converte o contrato do banco para dados simples que podem ir ao cliente. */
export function contratoParaForm(c: Contrato): ContratoForm {
  return {
    id: c.id,
    numero: c.numero,
    orgao: c.orgao,
    objeto: c.objeto,
    municipio: c.municipio,
    uf: c.uf,
    esfera: c.esfera,
    vigenciaInicio: paraInputData(c.vigenciaInicio),
    vigenciaFim: paraInputData(c.vigenciaFim),
    dataProposta: c.dataProposta ? paraInputData(c.dataProposta) : null,
    postos: c.postos,
    valorMensal: c.valorMensal ? c.valorMensal.toFixed(2) : null,
    ultimoApostilamento: c.ultimoApostilamento ? paraInputData(c.ultimoApostilamento) : null,
    maoDeObraDedicada: c.maoDeObraDedicada,
    tipoReajuste: c.tipoReajuste,
    convencaoId: c.convencaoId,
    clausulaReajuste: c.clausulaReajuste,
  };
}

export function convencoesParaForm(cs: Convencao[]) {
  return cs.map((v) => ({
    id: v.id,
    nome: v.nome,
    detalhe: `${[v.cidade, v.uf].filter(Boolean).join("/")} · data-base em ${MESES[v.mesDataBase - 1]}${v.situacao === "REGISTRADA" ? " · depositada" : " · pendente"}`,
  }));
}
