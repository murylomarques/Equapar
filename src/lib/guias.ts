/** Guias para busca (Produto e experiência, "Busca no Google"). Todo guia termina no Raio-X. */

export interface Guia {
  slug: string;
  titulo: string;
  descricao: string;
  secoes: { titulo: string; paragrafos: string[]; lista?: string[] }[];
  fontes: { nome: string; url: string }[];
}

export const GUIAS: Guia[] = [
  {
    slug: "repactuacao-passo-a-passo-lei-14133",
    titulo: "Repactuação passo a passo pela Lei 14.133",
    descricao: "O que é a repactuação, quando pedir, que documentos juntar e como acompanhar até o pagamento da diferença.",
    secoes: [
      {
        titulo: "O que é",
        paragrafos: [
          "Repactuação é a forma de manter o preço de contratos de serviços contínuos com mão de obra dedicada quando os custos sobem, por exemplo com uma nova convenção coletiva. Ela é diferente do reajuste por índice, que segue a cláusula do contrato.",
        ],
      },
      {
        titulo: "O que o pedido precisa ter",
        paragrafos: [
          "A lei pede a demonstração analítica da variação dos custos, feita pela planilha de custos ou pela convenção que fundamenta o pedido (Lei 14.133, art. 135, § 6º).",
        ],
        lista: [
          "A planilha de custos da proposta ou do último apostilamento.",
          "A convenção coletiva nova, já depositada no sistema Mediador.",
          "A planilha nova e a memória de cálculo, linha a linha, com a cláusula de origem de cada número.",
          "O ofício com o pedido: novo valor mensal, data de efeitos e pagamento das diferenças.",
        ],
      },
      {
        titulo: "Prazo de resposta",
        paragrafos: [
          "Nos contratos com mão de obra, a resposta tem prazo preferencial de 1 mês, contado da entrega da documentação (Lei 14.133, art. 92, § 6º). Guarde o número e a data do protocolo.",
        ],
      },
      {
        titulo: "Depois do deferimento",
        paragrafos: [
          "O deferimento não põe dinheiro no caixa sozinho. É preciso o apostilamento e, em muitos órgãos, uma nota fiscal separada para as diferenças retroativas. Acompanhe cada etapa até o recebimento.",
        ],
      },
    ],
    fontes: [{ nome: "TCU: Repactuação", url: "https://licitacoesecontratos.tcu.gov.br/6-2-2-1-3-repactuacao/" }],
  },
  {
    slug: "prorrogacao-sem-perder-a-repactuacao",
    titulo: "Prorrogação sem perder a repactuação: quando ressalvar",
    descricao: "Para o TCU, prorrogar sem pedir a repactuação encerra o direito. Veja os três casos e o que fazer em cada um.",
    secoes: [
      {
        titulo: "A regra",
        paragrafos: [
          "Para o TCU, se a empresa aceita prorrogar o contrato sem pedir a repactuação, ocorre a preclusão lógica e as condições econômicas antigas continuam valendo.",
        ],
      },
      {
        titulo: "Os três casos",
        paragrafos: ["Antes de assinar a prorrogação, veja em qual caso o seu contrato está:"],
        lista: [
          "Convenção registrada: peça a repactuação antes de assinar a prorrogação.",
          "Convenção ainda pendente: assine a prorrogação só com a ressalva do direito à repactuação no termo aditivo. O TCU admite essa ressalva (Acórdão 1.827/2008-Plenário, segundo a Zênite).",
          "Reajuste por índice: siga a cláusula de reajuste do contrato, que tem regra própria.",
        ],
      },
      {
        titulo: "Modelo de ressalva",
        paragrafos: [
          "\"A CONTRATADA ressalva o direito à repactuação decorrente da convenção coletiva de {ano}, ainda não depositada nesta data.\" Revise o texto com seu jurídico antes de usar.",
        ],
      },
    ],
    fontes: [
      { nome: "TCU: manutenção e prorrogação do contrato", url: "https://licitacoesecontratos.tcu.gov.br/6-3-manutencao-e-prorrogacao-do-contrato/" },
      { nome: "Zênite: convenção não depositada e repactuação após a prorrogação", url: "https://zenite.blog.br/cct-nao-depositada-x-direito-a-repactuacao-apos-a-prorrogacao/" },
    ],
  },
  {
    slug: "convencao-coletiva-limpeza-data-base",
    titulo: "Convenção coletiva de limpeza: como achar a data-base",
    descricao: "Onde encontrar a convenção de asseio e conservação da sua cidade, a data-base e o registro no sistema Mediador.",
    secoes: [
      {
        titulo: "Qual convenção vale",
        paragrafos: [
          "Vale a convenção da categoria e da base territorial onde o serviço é prestado, normalmente a de asseio e conservação da cidade ou do estado. Ela é a mesma usada na planilha de custos da proposta.",
        ],
      },
      {
        titulo: "Data-base e depósito",
        paragrafos: [
          "A data-base é o mês em que a categoria negocia os novos pisos. A convenção precisa estar depositada no Ministério do Trabalho, pelo sistema Mediador, e o número do registro deve ir no pedido.",
        ],
        lista: [
          "Procure a convenção no sistema Mediador pelo nome dos sindicatos ou pelo CNPJ do sindicato patronal.",
          "Anote a data-base, a data do depósito e o número do registro.",
          "Guarde o PDF: ele é anexo obrigatório do pedido.",
        ],
      },
    ],
    fontes: [{ nome: "Ministério do Trabalho: sistema Mediador", url: "https://www3.mte.gov.br/sistemas/mediador/" }],
  },
  {
    slug: "reforma-tributaria-contratos-publicos-reequilibrio",
    titulo: "Reforma tributária e contratos públicos: quem pode pedir reequilíbrio",
    descricao: "O regime da LC 214/2025 vale só para contratos anteriores à lei ou com proposta anterior a ela, e exige prova da carga efetiva.",
    secoes: [
      {
        titulo: "Quem está no regime",
        paragrafos: [
          "A LC 214/2025 criou um regime especial de reequilíbrio a partir do art. 373. Ele alcança só contratos firmados antes da lei ou com proposta apresentada antes dela.",
        ],
      },
      {
        titulo: "Não é automático",
        paragrafos: [
          "É preciso provar que a mudança alterou de fato os encargos, com a carga tributária efetiva suportada pela empresa (art. 374). Reequilíbrio preventivo, por projeção, não cabe. Se a carga cair, o órgão pode revisar o preço para baixo, de ofício (art. 375).",
        ],
      },
      {
        titulo: "Prazos",
        paragrafos: [
          "O pedido deve ser feito durante a vigência e antes de eventual prorrogação. A decisão tem prazo de 90 dias, que admite extensão.",
        ],
      },
    ],
    fontes: [
      { nome: "Conjur: reequilíbrio na LC 214/2025", url: "https://conjur.com.br/2025-ago-08/reequilibrio-dos-contratos-administrativos-impactados-pela-reforma-tributaria/" },
      { nome: "NetCPA: a reforma não desequilibra automaticamente", url: "https://netcpa.com.br/colunas/reforma-tributaria-desequilibra-automaticamente-os-contratos-administrativos/28150" },
      { nome: "Zênite: prazo do pedido de reequilíbrio", url: "https://zenite.blog.br/?p=21116" },
    ],
  },
  {
    // 5.1: texto para aprovação do dono (listado no relatório). Datas vêm da configuração, "a confirmar com o jurídico".
    slug: "jornada-40-horas-contratos-publicos",
    titulo: "Jornada de 40 horas e contratos públicos: como pedir o reequilíbrio",
    descricao: "A EC 141/2026 reduz a jornada semanal em etapas. Nos contratos com mão de obra dedicada, o preço precisa ser recomposto por aditivo.",
    secoes: [
      {
        titulo: "O que muda",
        paragrafos: [
          "A Emenda Constitucional 141/2026 reduz a jornada semanal de 44 para 40 horas, em etapas: primeiro 42 horas, depois 40. As datas exatas de cada etapa devem ser confirmadas com o seu jurídico.",
        ],
      },
      {
        titulo: "Dois caminhos para cada contrato",
        paragrafos: ["Em cada contrato, a empresa e o órgão precisam escolher um caminho. A Equapar mostra os dois lado a lado, com os números do seu contrato."],
        lista: [
          "Manter as horas de serviço: o órgão continua recebendo as mesmas horas por posto, com mais gente. O custo do posto sobe na proporção da jornada (44 ÷ 40 = 1,10).",
          "Reduzir as horas de serviço: o valor mensal não muda e o órgão passa a receber menos horas por posto.",
        ],
      },
      {
        titulo: "O que o pedido precisa ter",
        paragrafos: ["O pedido de reequilíbrio vai por termo aditivo, com a demonstração da variação dos custos."],
        lista: [
          "A planilha de custos atual do contrato.",
          "A planilha nova e a memória de cálculo do cenário escolhido.",
          "O ofício com o pedido e a minuta do aditivo, revisados pelo seu jurídico.",
        ],
      },
    ],
    fontes: [{ nome: "Conjur: o fim da escala 6x1 e a repercussão nos contratos públicos", url: "https://conjur.com.br/2026-out-24/o-fim-da-escala-6x1-e-a-repercussao-nos-contratos-publicos/" }],
  },
];
