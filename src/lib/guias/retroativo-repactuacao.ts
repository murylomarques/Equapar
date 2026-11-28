import type { Guia } from "./tipos";

export const retroativoRepactuacao: Guia = {
  "slug": "retroativo-repactuacao",
  "titulo": "Retroativo da repactuação: desde quando vale e como cobrar",
  "descricao": "Retroativo da repactuação: desde quando valem os efeitos, como calcular a diferença por mês e por posto, como receber e como não perder o direito.",
  "termo": "retroativo da repactuação",
  "atualizadoEm": "2026-11-27",
  "revisao": "aprovada",
  "resumo": [
    "O retroativo da repactuação é a diferença entre o preço novo e o preço antigo do contrato, acumulada desde a data em que a repactuação passa a valer até o mês em que o órgão começa a pagar o valor novo.",
    "Como regra geral, os efeitos valem desde o fato gerador, que nos custos de mão de obra corresponde à data de efeitos financeiros da alteração aplicável, frequentemente a data-base da convenção coletiva, e não desde a data do seu pedido.",
    "A conta é a diferença mensal do contrato vezes os meses do período, com o mês incompleto proporcional aos dias.",
    "O pagamento costuma vir depois do apostilamento e, em muitos órgãos, numa nota fiscal separada só para as diferenças.",
    "A prorrogação ou o encerramento sem pedido tempestivo pode causar a perda do retroativo de direito já constituído."
  ],
  "secoes": [
    {
      "titulo": "O que é o retroativo da repactuação",
      "paragrafos": [
        "A repactuação recompõe o preço de contratos de serviços contínuos com dedicação exclusiva ou predominância de mão de obra, a partir da variação dos custos, por exemplo uma convenção coletiva nova (Lei 14.133/2021, art. 6º, LIX, e art. 135).",
        "Entre a data-base da convenção e o dia em que o órgão passa a pagar o valor novo, costumam se passar meses. A convenção sai depois da data-base, você monta o pedido, o órgão analisa e formaliza. Nesse intervalo, sua empresa já paga os salários novos, mas fatura pelo preço antigo.",
        "O retroativo é a soma dessas diferenças. É uma diferença que pode ser devida à empresa quando preenchidos os requisitos contratuais e legais, comprovada a variação de custos e preservado o direito."
      ]
    },
    {
      "titulo": "Desde quando valem os efeitos",
      "paragrafos": [
        "Para os custos de mão de obra, a repactuação fica vinculada ao acordo, à convenção ou ao dissídio coletivo (Lei 14.133, art. 135, II). O manual do TCU explica que a data-base é a data de início dos efeitos financeiros da convenção, o chamado fato gerador da repactuação.",
        "A IN SEGES/MP 05/2017, que a IN SEGES/ME 98/2022 autoriza aplicar, no que couber, aos contratos da Lei 14.133, detalha as três hipóteses no art. 58:"
      ],
      "lista": [
        "Regra geral: o valor novo vale a partir do fato gerador que deu causa à repactuação.",
        "Data futura: só se as partes acordarem. Atenção: aceitar uma data futura reduz o seu retroativo.",
        "Data anterior ao fato gerador: só quando a própria convenção prevê vigência retroativa para os custos de mão de obra.",
        "Custos de mercado (insumos, materiais) seguem outra data: a da proposta (Lei 14.133, art. 135, I). Eles podem ser repactuados em momento diferente da mão de obra (art. 135, § 4º)."
      ]
    },
    {
      "titulo": "Como calcular a diferença retroativa",
      "paragrafos": [
        "A conta tem três passos. Primeiro, a diferença mensal: valor mensal da planilha nova menos valor mensal da planilha atual, somando todos os postos. Segundo, multiplique pelos meses cheios do período. Terceiro, no mês incompleto, aplique o critério contratual de medição e faturamento. Quando a regra for por dias corridos, use: diferença mensal × dias do período ÷ dias do mês. Considere mudanças na quantidade de postos, glosas e valores efetivamente faturados.",
        "A diferença sai da planilha inteira, e não só do salário. Quando o piso sobe, sobem junto os itens calculados sobre ele, como encargos, provisões e tributos. Mas os efeitos financeiros valem só para os itens que motivaram a repactuação e só pela diferença (IN 05/2017, art. 58, parágrafo único).",
        "Exemplo fictício: 10 postos de servente. Valor por posto antes: R$ 5.200,00. Depois da convenção nova: R$ 5.488,40. Diferença mensal do contrato: 10 × R$ 288,40 = R$ 2.884,00. Data-base: 01/01/2026. O órgão passou a faturar o valor novo a partir de 13/05/2026.",
        "Neste exemplo, maio foi contado por dias corridos (12 de 31 dias). Se o seu contrato ou o órgão usar mês comercial de 30 dias, maio daria R$ 1.153,60 e o total, R$ 12.689,60. Combine a regra antes e deixe-a escrita no pedido."
      ],
      "tabela": {
        "legenda": "Exemplo fictício: retroativo de 10 postos, diferença mensal de R$ 2.884,00",
        "cabecalho": [
          "Competência",
          "Dias considerados",
          "Diferença"
        ],
        "linhas": [
          [
            "Janeiro/2026",
            "31 de 31",
            "R$ 2.884,00"
          ],
          [
            "Fevereiro/2026",
            "28 de 28",
            "R$ 2.884,00"
          ],
          [
            "Março/2026",
            "31 de 31",
            "R$ 2.884,00"
          ],
          [
            "Abril/2026",
            "30 de 30",
            "R$ 2.884,00"
          ],
          [
            "Maio/2026 (1 a 12)",
            "12 de 31",
            "R$ 1.116,39"
          ],
          [
            "Total do retroativo",
            "",
            "R$ 12.652,39"
          ]
        ]
      }
    },
    {
      "titulo": "Não é o mesmo que o retroativo do dissídio",
      "paragrafos": [
        "Quando a convenção é assinada depois da data-base e manda pagar os salários novos desde a data-base, sua empresa deve a diferença aos empregados. Esse é o retroativo do dissídio, uma obrigação trabalhista entre a empresa e os empregados. Os prazos de pagamento estão na própria convenção.",
        "O retroativo da repactuação é outra relação: é o que o órgão deve à sua empresa pelo contrato. Ele depende de pedido, de planilha e de análise do órgão. Por isso, os dois raramente chegam juntos. Na prática, a empresa costuma pagar os empregados primeiro e receber do órgão depois. Planeje o caixa para isso.",
        "Os valores também são diferentes. O do dissídio é a diferença salarial e seus reflexos na folha. O da repactuação é a diferença do preço do posto, que inclui encargos, custos indiretos, lucro e tributos da planilha. E nem tudo que está na convenção entra: o órgão não se vincula a cláusulas de participação nos lucros, de matéria não trabalhista ou que só se aplicam a contratos com a Administração (Lei 14.133, art. 135, §§ 1º e 2º)."
      ]
    },
    {
      "titulo": "Como o retroativo é pago",
      "paragrafos": [
        "A repactuação prevista no contrato pode ser registrada por simples apostila, sem termo aditivo (Lei 14.133, art. 136, I). Pela IN 05/2017 (art. 57, § 4º), quando coincide com a prorrogação, vai no termo aditivo.",
        "Depois do apostilamento, o fluxo varia de órgão para órgão. O procedimento do HC-UFTM (Ebserh), por exemplo, prevê: atualizar os valores mensais do contrato, pedir à empresa a nota fiscal da diferença retroativa, fazer a planilha de retenção da conta vinculada sobre as diferenças e abrir o processo de pagamento. Outros órgãos pedem uma tabela dos valores retroativos por período e empenham a diferença antes de pagar, como na instrução da UFSCar."
      ],
      "lista": [
        "Pergunte ao fiscal se a diferença vai em nota fiscal separada ou na fatura do mês.",
        "Emita a nota só pelo valor homologado no apostilamento, com o período de competência na descrição.",
        "Confira a retenção da conta vinculada sobre o retroativo, se o seu contrato tiver conta vinculada.",
        "Acompanhe o empenho: sem empenho da diferença, o pagamento não sai."
      ]
    },
    {
      "titulo": "Como você pode perder o retroativo",
      "paragrafos": [
        "O maior risco é o prazo. A repactuação que não for pedida durante a vigência preclui com a assinatura da prorrogação ou com o encerramento do contrato (IN 05/2017, art. 57, § 7º). O TCU chama isso de preclusão lógica: ao prorrogar sem pedir, você aceita o preço antigo (Acórdão 8237/2011-Segunda Câmara, segundo o manual do TCU)."
      ],
      "lista": [
        "Assinar o termo aditivo de prorrogação sem ter pedido a repactuação, nem ressalvado o direito.",
        "Deixar o contrato acabar sem ter protocolado o pedido.",
        "Aceitar, sem perceber, que os efeitos comecem numa data futura (IN 05/2017, art. 58, II).",
        "Pedir com base numa convenção que já estava na sua proposta. O TCU aponta esse caso como risco de repactuação indevida.",
        "Mandar o pedido incompleto. O prazo de resposta do órgão só corre depois que a documentação está completa (Enunciado CJF 25/2022, citado pelo TCU)."
      ]
    },
    {
      "titulo": "Checklist para cobrar o retroativo",
      "paragrafos": [
        "Antes de protocolar, confira se o pedido deixa claro o que você quer receber e desde quando:"
      ],
      "lista": [
        "Data-base da convenção nova e número do registro no sistema Mediador.",
        "Planilha atual e planilha nova, posto a posto, com a memória de cálculo.",
        "Pedido expresso de efeitos desde a data juridicamente aplicável e de pagamento das diferenças retroativas.",
        "Tabela do retroativo por competência, com a regra do mês incompleto.",
        "Número e data do protocolo guardados, para contar o prazo de resposta."
      ]
    },
    {
      "titulo": "Retroativo sem conta de cabeça",
      "paragrafos": [
        "Na Equapar, a memória de cálculo mostra o retroativo mês a mês, a partir da convenção cadastrada, com a regra de mês incompleto escolhida no pedido."
      ]
    }
  ],
  "faq": [
    {
      "pergunta": "A repactuação retroage à data-base da convenção?",
      "resposta": "Frequentemente, sim, desde que a norma coletiva atribua efeitos financeiros à data-base, a anualidade esteja cumprida e haja execução contratual no período. A IN 05/2017, art. 58, admite também data futura acordada e a retroatividade prevista em norma coletiva."
    },
    {
      "pergunta": "O órgão pode pagar só a partir da data do meu pedido?",
      "resposta": "A regra geral não é essa: o marco é o fato gerador, não o protocolo. Se o órgão propuser outra data, avalie o fundamento e os efeitos financeiros antes de aceitar, porque concordar com data futura reduz o retroativo."
    },
    {
      "pergunta": "Preciso emitir nota fiscal separada para o retroativo?",
      "resposta": "Depende do órgão. Vários pedem uma nota só da diferença retroativa, como o procedimento do HC-UFTM. Pergunte ao fiscal antes de faturar e use o valor homologado no apostilamento."
    },
    {
      "pergunta": "O contrato acabou. Ainda posso cobrar o retroativo?",
      "resposta": "Se o pedido foi tempestivo, a extinção do contrato não impede por si só o reconhecimento de diferenças devidas, observado o regime aplicável (Lei 14.133, art. 131). Se não pediu, a IN 05/2017 (art. 57, § 7º) diz que o direito preclui com o encerramento do contrato."
    },
    {
      "pergunta": "Quanto tempo o órgão tem para responder?",
      "resposta": "Nos contratos com mão de obra, o prazo é preferencialmente de 1 mês, contado da entrega da documentação completa (Lei 14.133, art. 92, § 6º)."
    }
  ],
  "fontes": [
    {
      "nome": "TCU, Licitações e Contratos: Repactuação",
      "url": "https://licitacoesecontratos.tcu.gov.br/6-2-2-1-3-repactuacao/"
    },
    {
      "nome": "Lei 14.133/2021 (Planalto)",
      "url": "https://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2021/Lei/L14133.htm"
    },
    {
      "nome": "IN SEGES/MP 05/2017 (gov.br/compras)",
      "url": "https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-5-de-26-de-maio-de-2017-atualizada"
    },
    {
      "nome": "IN SEGES/ME 98/2022 (gov.br/compras)",
      "url": "https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-98-de-26-de-dezembro-de-2022"
    },
    {
      "nome": "HC-UFTM (Ebserh): POP de repactuação de contratos",
      "url": "https://www.gov.br/hubrasil/pt-br/hospitais-universitarios/regiao-sudeste/hc-uftm/documentos/procedimentos-e-rotinas-operacionais-padrao/pops/POP.HCUFTM.UFAC.001RepactuacaodeContratosdeServicoscomDedicacaoExclusivadeMaodeObraversao3.pdf"
    },
    {
      "nome": "UFSCar: instrução de trabalho para repactuação",
      "url": "https://www.proad.ufscar.br/pt-br/assets/arquivos/instrucoes-alternativas-repactuacao-de-contratos.pdf"
    }
  ],
  "relacionados": [
    "como-calcular-repactuacao",
    "prazo-pedido-repactuacao-preclusao",
    "prorrogacao-sem-perder-a-repactuacao",
    "modelo-pedido-repactuacao"
  ]
};
