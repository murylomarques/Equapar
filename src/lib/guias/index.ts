/** Lista dos guias (a ordem é a da página /guias: primeiro os de entrada, depois os de aprofundamento). */
export type { Guia, SecaoGuia } from "./tipos";
import type { Guia } from "./tipos";
import { repactuacaoPassoAPassoLei14133 } from "./repactuacao-passo-a-passo-lei-14133";
import { comoCalcularRepactuacao } from "./como-calcular-repactuacao";
import { modeloPedidoRepactuacao } from "./modelo-pedido-repactuacao";
import { prazoPedidoRepactuacaoPreclusao } from "./prazo-pedido-repactuacao-preclusao";
import { prorrogacaoSemPerderARepactuacao } from "./prorrogacao-sem-perder-a-repactuacao";
import { retroativoRepactuacao } from "./retroativo-repactuacao";
import { convencaoColetivaLimpezaDataBase } from "./convencao-coletiva-limpeza-data-base";
import { reajusteRepactuacaoReequilibrioDiferencas } from "./reajuste-repactuacao-reequilibrio-diferencas";
import { repactuacaoPorParcelas } from "./repactuacao-por-parcelas";
import { lei14133In98In052017Repactuacao } from "./lei-14133-in-98-in-05-2017-repactuacao";
import { jornada40HorasContratosPublicos } from "./jornada-40-horas-contratos-publicos";
import { reformaTributariaContratosPublicosReequilibrio } from "./reforma-tributaria-contratos-publicos-reequilibrio";

export const GUIAS: Guia[] = [
  repactuacaoPassoAPassoLei14133,
  comoCalcularRepactuacao,
  modeloPedidoRepactuacao,
  prazoPedidoRepactuacaoPreclusao,
  prorrogacaoSemPerderARepactuacao,
  retroativoRepactuacao,
  convencaoColetivaLimpezaDataBase,
  reajusteRepactuacaoReequilibrioDiferencas,
  repactuacaoPorParcelas,
  lei14133In98In052017Repactuacao,
  jornada40HorasContratosPublicos,
  reformaTributariaContratosPublicosReequilibrio,
];

/**
 * Ampliações de guias já publicados, aguardando o advogado. Não entram no site: quando aprovadas, o conteúdo
 * substitui o arquivo publicado (mesmo slug) e o rascunho sai daqui.
 */
export const RASCUNHOS: Guia[] = [];
