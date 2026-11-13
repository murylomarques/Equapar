# Regras de cálculo

Código: `src/lib/calculo/motor.ts` (motor) e `src/lib/pedido.ts` (uso no pedido). Versão atual da regra: **`IN05-2017-AnexoVII-D/v1`** (`VERSAO_REGRA`). Toda mudança de regra passa pelo dono (trava 3 do projeto) e entra no [CHANGELOG](../CHANGELOG.md) com a versão.

## Princípios

- **Aritmética decimal exata** (decimal.js). Nunca ponto flutuante.
- **Cada linha é arredondada a 2 casas** (meio para cima) antes de entrar em somas, como numa planilha preenchida à mão. O total é a soma das linhas arredondadas.
- **A IA nunca produz número final.** A leitura de PDF só sugere entradas, que a pessoa confirma.
- **Pedido protocolado não é recalculado** (é documento entregue ao órgão).

## Estrutura da planilha

Segue o Anexo VII-D da IN SEGES/MP 05/2017: Módulo 1 (remuneração), Submódulos 2.1 (13º, férias), 2.2 (encargos), 2.3 (benefícios), Módulo 3 (rescisão), Módulo 4 (reposição do ausente), Módulo 5 (insumos), Módulo 6 (custos indiretos, lucro e tributos).

| Base de percentual | O que soma |
| --- | --- |
| salário base | a linha marcada como salário base |
| Módulo 1 | Módulo 1 |
| Módulo 1 + Submódulo 2.1 | Módulo 1 e Submódulo 2.1 |
| Módulos 1 a 3 | Módulos 1, 2 e 3 |
| Módulos 1 a 5 | subtotal antes do Módulo 6 |
| Módulos 1 a 5 + custos indiretos | base do lucro |
| preço final (por dentro) | base dos tributos |

- **Percentual** = valor ÷ 100 × base.
- **Tributos "por dentro"**: preço = base ÷ (1 − Σ alíquotas); cada tributo = preço × alíquota. A diferença de centavos do arredondamento vai para a última linha de tributo, para que base + tributos = preço.
- **Valor mensal** = valor por posto × quantidade de postos, somado por tipo de posto.

## Diferença mensal e retroativa

- **Diferença por mês** = valor mensal da planilha nova − valor mensal da planilha atual.
- **Retroativo** = soma, mês a mês, da data-base até a data final:
  - mês cheio: a diferença mensal;
  - mês incompleto, **padrão (dias corridos)**: diferença × dias ÷ dias do mês;
  - mês incompleto, **opção "mês de 30 dias"** (L11, só quando o pedido escolhe): diferença × dias ÷ 30, com no máximo 30 dias.
- **Data final**, padrão: a data informada no passo 3. Opções do pedido (L11): a data do protocolo ou a do apostilamento; enquanto ela não existe, vale a data informada.
- A regra escolhida aparece na memória, no PDF e no ofício. Depois do deferimento, a tela mostra à parte, **só como informação**, a diferença acumulada até hoje.

## Fontes legais

| Regra | Fonte |
| --- | --- |
| Estrutura da planilha | IN SEGES/MP 05/2017, Anexo VII-D |
| Repactuação e demonstração analítica | Lei 14.133/2021, art. 135, § 6º ([TCU](https://licitacoesecontratos.tcu.gov.br/6-2-2-1-3-repactuacao/)) |
| Prazo preferencial de resposta | Lei 14.133/2021, art. 92, § 6º ([TCU](https://licitacoesecontratos.tcu.gov.br/6-2-2-1-3-repactuacao/)) |
| Preclusão ao prorrogar sem pedir | [TCU, Licitações e Contratos, 6.3](https://licitacoesecontratos.tcu.gov.br/6-3-manutencao-e-prorrogacao-do-contrato/) |
| Ressalva no termo aditivo | TCU, Acórdão 1.827/2008-Plenário ([Zênite](https://zenite.blog.br/cct-nao-depositada-x-direito-a-repactuacao-apos-a-prorrogacao/)) |

## Assinatura do cálculo aprovado

Ao aprovar a memória, o sistema grava `hashCalculo`: SHA-256 do JSON canônico de planilhas, data-base, data de referência, gatilho, versão da regra e, quando diferem do padrão, as opções do retroativo. PDFs, memória e "Gerar pedido" só tratam a memória como aprovada se a assinatura atual for igual à aprovada. Qualquer mudança na base do cálculo desfaz a aprovação e volta o pedido para "em análise".

## Casos de teste

`src/lib/calculo/motor.test.ts` e `retroativo-opcoes.test.ts`. O caso do exemplo precisa continuar dando:

- R$ 5.219,15 por posto (Servente, planilha antes);
- R$ 58.805,66 → R$ 62.070,27 por mês (diferença de R$ 3.264,61);
- retroativo de R$ 33.951,94, de 01/01/2026 a 12/11/2026 (regra padrão).

## Decisões em aberto (do dono, com advogado)

1. **Retroativo (L11):** qual "data final" e qual regra de mês incompleto usar por padrão. Hoje: data informada e dias corridos.
2. **Jornada de 40 horas (EC 141/2026, fase 2):** datas, prazo do aditivo e se o padrão é manter ou reduzir as horas de serviço. Nada disso está no motor.
3. **Reforma tributária:** módulo fora do MVP por decisão do dossiê; o sistema só marca se o contrato é anterior à LC 214/2025.
