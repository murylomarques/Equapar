/**
 * Guias para busca (Produto e experiência, "Busca no Google"). Cada guia responde a uma pergunta que a empresa
 * terceirizada digita no Google e termina no Raio-X. Um arquivo por guia nesta pasta; a lista fica em index.ts.
 */

export interface SecaoGuia {
  titulo: string;
  /** Parágrafos. Um parágrafo inteiro entre aspas ("...") vira um modelo de texto com botão de copiar. */
  paragrafos: string[];
  lista?: string[];
  /** Tabela simples (ex.: exemplo de cálculo). A primeira coluna é o rótulo da linha. */
  tabela?: { legenda?: string; cabecalho: string[]; linhas: string[][] };
  /** Parágrafos que vêm depois da lista e da tabela (ex.: uma ressalva sobre o exemplo). */
  paragrafosDepois?: string[];
}

export interface Guia {
  slug: string;
  titulo: string;
  /** Descrição para o Google (até ~160 caracteres) e subtítulo da página. */
  descricao: string;
  /** Termo de busca principal que a página quer ganhar (uso interno: SEO e revisão). */
  termo?: string;
  /** Data da última revisão do conteúdo (AAAA-MM-DD), mostrada como "Atualizado em". */
  atualizadoEm?: string;
  /**
   * "pendente": o texto afirma regra jurídica e ainda não foi revisado pelo advogado. Não entra no ar (404) nem no mapa
   * do site até virar "aprovada". Guias sem o campo seguem a regra antiga (já publicados).
   */
  revisao?: "pendente" | "aprovada";
  /** 3 a 5 frases curtas no topo ("Em resumo"): a resposta direta que o Google gosta de destacar. */
  resumo?: string[];
  secoes: SecaoGuia[];
  /** Perguntas frequentes: vão para a página e para o JSON-LD FAQPage. */
  faq?: { pergunta: string; resposta: string }[];
  fontes: { nome: string; url: string }[];
  /** Slugs de outros guias para "Leia também". */
  relacionados?: string[];
}
