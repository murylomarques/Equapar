# Auditoria total: relatório final

Branch `auditoria-total` (base `697711f`, sem merge e sem deploy). Tudo local, com dados fictícios: nenhuma cobrança real, nenhum cancelamento real no Asaas, nenhuma chamada paga à Anthropic.

Documentos: [MATRIZ-TELAS.md](MATRIZ-TELAS.md) (todas as telas, achados e situação) · [COBRANCA.md](COBRANCA.md) (política, webhook, revisão independente) · [IA.md](IA.md) (preços, custos, cotas propostas com margem).

## Como foi verificado (e o que isso não prova)

- **Capturas reais** em 5 resoluções (1440×900, 1920×1080, 768×1024, 390×844, 375×667): antes (build de `697711f`) e depois (build final), em `D:\Equapar\capturas-auditoria`, com a comparação lado a lado em `comparacao.html`.
- **Quatro revisões visuais independentes** (cada uma com um quarto das telas) e **uma revisão independente do código** de cobrança, IA e avisos, todas sem acesso às minhas conclusões. Elas encontraram problemas que eu não tinha visto, inclusive regressões minhas e falhas P0 de cobrança; todos estão na matriz e no COBRANCA.md.
- Quantidade de capturas e de testes não é prova de qualidade: os itens **pendentes** estão listados abaixo e na matriz, com severidade.

## Funcionalidades testadas

| Área | Como | Resultado |
|---|---|---|
| Raio-X, criação de conta, confirmação de e-mail, primeiros passos | `npm run e2e` (computador e celular) | ok |
| Cadastro de contrato, convenção, importação | `e2e` | ok |
| Pedido completo: passos 1–5, fonte por linha, memória, aprovação, arquivos, protocolo, deferimento, nota, recebimento | `e2e`, `e2e:financeiro` | ok |
| Arquivos finais bloqueados sem versão aprovada; prévia RASCUNHO; outra conta 404 | `e2e:financeiro`, `bloqueadoras/c2–c4, s4` | ok |
| Avisos: um evento por ocorrência, urgência, clique leva ao contexto certo | `e2e:auditoria` (D) | ok |
| Contratação, previsão antes de confirmar, pagamento, cancelamento com data, desfazer | `e2e:auditoria` (E, F) | ok |
| IA sem orçamento não aparece nem chama | `e2e:auditoria` (G) + testes de banco | ok |
| Demonstração isolada, sessões | `bloqueadoras/c6` | ok |
| Recurso e novo pedido, isolamento entre contas | `e2e/fase2.mjs` | ok |
| Jornada de 40 horas (simulação) | `e2e/jornada.mjs` | ok |
| Modo piloto | `e2e/modo-piloto.mjs` (agora autossuficiente) | ok |
| Cabeçalhos de segurança | `bloqueadoras/s3` | ok |

## Resultado dos testes (build final)

| Comando | Resultado |
|---|---|
| `npm run lint` · `npm run typecheck` · `npm run build` | ok |
| `npm run test:db` | **373 ok** (79 arquivos), inclusive 22 de assinatura e 13 de orçamento de IA no banco |
| `npm run e2e` | 94 ok |
| `npm run e2e:auditoria` · `npm run e2e:financeiro` | 12 ok · 23 ok |
| `npm run e2e:a11y` | 105 verificações, **0 violações graves** (axe) |
| `npm run e2e:teclado` · `e2e/sem-rolagem-lateral.mjs` | 14 ok · 39 ok |
| `fase2`, `jornada`, `modo-piloto`, `bloqueadoras` (c2, c3, c6, s3, s4) | ok |

Concorrência coberta por testes de banco: 5 entregas simultâneas do mesmo webhook (aplica uma vez), 3 cliques simultâneos na mesma compra (uma fatura, uma cobrança), duas rotinas de renovação ao mesmo tempo (uma renovação), 20 reservas de IA simultâneas (não passam do teto da conta), várias contas ao mesmo tempo (não passam do teto global).

## Performance (laboratório)

Lighthouse 12.8.2, celular simulado (4G lento, CPU 4×), Edge headless nesta máquina, build de produção local (`next start`), 3 rodadas, mediana:

| Página | Nota | LCP | FCP | TBT | CLS |
|---|---|---|---|---|---|
| `/` (landing) | 95 | 2,62 s | 0,92 s | 164 ms | 0,000 |
| `/precos` | 96 | 2,58 s | 0,91 s | 94 ms | 0,000 |
| `/raio-x` | 93 | 2,80 s | 0,91 s | 174 ms | 0,000 |

- **CLS 0,00** (meta 0,1): ok. **TBT** abaixo de 200 ms (o INP não é medível em laboratório; TBT é o indicador mais próximo).
- **LCP 2,6–2,8 s, acima da meta de 2,5 s.** O elemento LCP da landing é o parágrafo da abertura; 82% do tempo é "atraso de renderização" depois do FCP, e a fonte desse texto já usa `display: optional` (não é troca de fonte). No modelo simulado do Lighthouse isso costuma vir de JavaScript no carregamento. Ação: medir em produção com dados de campo (CDN e rede reais) antes de otimizar; se confirmado, reduzir o JavaScript da landing. Não otimizei às cegas.
- Telas logadas não foram medidas no Lighthouse (exigem sessão); ficam para a medição em produção.

## Situação dos riscos financeiros

| Risco | Situação |
|---|---|
| Acesso pago sem pagar (clique, upgrade abandonado, cancelamento, renovação não paga) | Fechado: acesso só por período pago; régua pelo calendário até somente leitura |
| Cobrança duplicada (cliques, renovação + upgrade, rotina repetida, cobrança duplicada paga) | Fechado no código; pagamento duplicado marcado para devolução manual |
| Evento repetido, simultâneo ou fora de ordem | Fechado (idempotência transacional, travas, transições monotônicas) |
| Cliente perde acesso pago | Fechado (cancelamento no fim do período; estorno tira só o período estornado) |
| Gasto de IA | Fechado: orçamento zero; reserva atômica com entrada contada; tetos por conta e global |
| Assinatura manual no painel do Asaas | Risco operacional: não criar (ver COBRANCA.md) |
| Devoluções e crédito proporcional | Manuais, por decisão (sem política aprovada) |
| Validação com o sandbox real do Asaas | **Não feita** (precisa de chave de sandbox e URL pública para o webhook) |

## Proposta de orçamento de IA

Tabela completa com premissas e margem em [IA.md](IA.md). Resumo: Grátis US$ 0; Piloto US$ 5/conta/mês; Carteira US$ 5; Assessoria US$ 20; global US$ 150/mês no início. Pior caso de 9,1% da receita na Carteira mínima (R$ 297) e uso típico de 2,5%. **Tudo segue em zero até a sua decisão.**

## Revisão comercial da landing e dos preços

**Primeira impressão (dono de empresa de limpeza, poucos segundos):** a abertura diz para quem é ("empresas de limpeza e conservação com contratos públicos"), o problema ("a convenção subiu; o seu contrato também pode subir"), o que a Equapar faz e o próximo passo (CNPJ, grátis, sem cadastro). A prévia da tela mostra o produto real com dados marcados como exemplo. Isso está bom.

**O que atrapalhava e foi corrigido:** página de preços desalinhada (margens, coluna vazia, ações em alturas diferentes) e com o mesmo conteúdo repetido abaixo dos cartões; comparação "Três jeitos" escondendo justamente a coluna da Equapar no celular; quadro vazio no lugar da foto.

**O que ainda pesa (pendente, decisão de conteúdo):** a landing tem 10 seções, repete o formulário de CNPJ 3 vezes e um mockup duas vezes, e o aviso "exemplo ilustrativo" aparece 5 vezes. Recomendo cortar para: abertura → problema → como funciona → preços → perguntas → chamada final (6 blocos), um formulário a mais só no fim.

**Caminho até experimentar ou contratar:** Raio-X (grátis) → criar conta → primeiros passos → primeiro pedido. A passagem para o pago acontece em Configurações › Cobrança, com previsão antes de confirmar. Não há provas sociais, números de resultado ou selos inventados; a página mostra só o que existe.

## Recomendações comerciais (máximo cinco)

1. **ICP explícito:** empresa de limpeza/portaria com 2 a 30 contratos públicos e 50 a 500 postos (abaixo de ~75 postos todos pagam o mínimo). Validar contando as faixas no levantamento do PNCP.
2. **Ativação = primeira memória aprovada em até 14 dias** da conta criada; os eventos já existem.
3. **Decidir crédito de upgrade e devoluções** (hoje manuais e sinalizadas).
4. **Aprovar as cotas de IA** depois da avaliação real com o gabarito.
5. **Encurtar a landing** como acima e testar o Piloto como entrada da Carteira (hipótese, sem mexer em preço).

## Pendências realmente necessárias para produção

1. Advogado: aprovar termos, privacidade e minutas; só então tirar a faixa "MINUTA".
2. Dados da empresa: `SITE_RAZAO_SOCIAL`, `SITE_CNPJ`, endereço (o rodapé ainda diz "empresa em constituição").
3. Asaas: chave de sandbox, webhook apontando para URL pública, rodar os cenários de cobrança no sandbox; depois a chave de produção. Não criar assinaturas no painel do Asaas.
4. Rodar a rotina de hora em hora em produção (worker ou cron `/api/cron/avisos`): ela gera renovações e anda a régua de cobrança.
5. Conferir os dados reais de cobrança antes de aplicar a migração `20261124120000_protecao_financeira` (o backfill só data períodos válidos).
6. IA: decidir as cotas, rodar a avaliação com orçamento de avaliação, então ligar.
7. Medir Core Web Vitals em produção; agir no LCP se o campo confirmar.
8. Decidir a anualidade pré-marcada "Conferida" no passo 3 (tornar a escolha obrigatória muda a regra de validação).

Itens P2/P3 de acabamento ainda abertos estão na matriz; nenhum bloqueia o fluxo principal.
