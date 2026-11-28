import type { Guia } from "./tipos";

export const convencaoColetivaLimpezaDataBase: Guia = {
  slug: "convencao-coletiva-limpeza-data-base",
  titulo: "Convenção coletiva de limpeza: como achar a data-base",
  descricao:
    "Onde encontrar a convenção de asseio e conservação da sua cidade, a data-base e o registro no sistema Mediador.",
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
  fontes: [
    {
      nome: "Ministério do Trabalho: sistema Mediador",
      url: "https://www3.mte.gov.br/sistemas/mediador/",
    },
  ],
  relacionados: ["como-calcular-repactuacao","prazo-pedido-repactuacao-preclusao","modelo-pedido-repactuacao"],
};
