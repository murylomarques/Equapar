# Auditoria total: relatório

Branch `auditoria-total` (a partir de `697711f`). Tudo local, com dados fictícios: nenhuma cobrança real, nenhum cancelamento real no Asaas, nenhuma chamada paga à Anthropic, nenhum deploy. Detalhes: [COBRANCA.md](COBRANCA.md) e [IA.md](IA.md).

Stack confirmada: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Prisma 6 + PostgreSQL, Lucide, Vitest 5, Playwright (playwright-core, Edge).

## A. Diagnóstico inicial

| # | Sev. | Problema | Evidência | Impacto |
|---|---|---|---|---|
| C1 | P0 | Escolher Grátis cancelava o plano na hora, mesmo pago | `configuracoes/acoes.ts`, ramo `GRATIS` | cliente perde o período pago |
| C2 | P0 | Cancelamento não cancelava cobranças em aberto | idem | pagamento posterior sem ativação; vencimento levava conta Grátis a somente leitura |
| C3 | P0 | Plano pago nunca vencia | não havia período nem renovação | perda de receita |
| C4 | P0 | Estorno não mexia no acesso | `planos.ts` | estorno integral mantinha o plano |
| C5 | P0 | Idempotência do webhook fora da transação | `cobranca-servidor.ts` | 500 em entregas simultâneas |
| C7 | P0 | "Simular pagamento" em produção sem Asaas | `configuracoes/page.tsx` | cliente "pagaria" o próprio plano |
| I1–I7 | P0 | IA sem teto nenhum (conta, plano, global), sem registro, sem limite de documento, tentativas fora de controle | `ia.ts` | gasto ilimitado assim que a chave fosse ligada |
| V1 | P1 | Avisos: um cartão por mensagem, texto cru com links de rastreio, sem ação | captura `40-avisos` | usuário não sabe o que fazer nem onde |
| V2 | P1 | Passo 3: 7 campos empilhados por linha, só com placeholder cortado | captura `32-pedido-passo-3-tablet` | esforço alto, erro de preenchimento |
| V3 | P1 | Hoje somava o valor deferido inteiro; A receber, o saldo | código | números diferentes em duas telas |
| V4 | P2 | 7 páginas do site sem margem lateral (texto colado na borda) e desalinhadas do cabeçalho | capturas `05-precos-tablet`, `-desktop` | aparência amadora |
| V5 | P2 | Grade de planos com coluna vazia; calculadora com preço fixo no código | capturas, `calculadora-preco.tsx` | espaço desperdiçado; risco de preço divergente |
| V6 | P2 | Quadro vazio no lugar da foto na landing | captura `01-landing` | parece inacabado |
| V7 | P2 | Hoje (celular): pesquisa acima das ações; "resposta até —"; rótulo antigo "Gerar cobrança" | captura `14-hoje-celular` | primeira tela sem o trabalho do dia |
| V8 | P2 | Carteira (celular): texto colado ("30/11/2026Próximo"); 7 filtros ocupando a tela | captura `19-carteira-compacto` | leitura difícil |

## B. Alterações implementadas

| Área | Antes | Depois |
|---|---|---|
| Assinatura (`assinatura.ts`, `cobranca-servidor.ts`) | plano = clique; nunca vencia | acesso pelos períodos pagos; renovação gerada pela Equapar; cancelamento no fim do período, com data e opção de desfazer; downgrade e troca de ciclo na renovação; só cobranças não iniciadas são canceladas (também no Asaas) |
| Webhook | checagem fora da transação | `ON CONFLICT DO NOTHING` + `FOR UPDATE`, transições monotônicas, estorno integral/parcial, contestação, restauração |
| Tela de cobrança | plano, escolha e faturas misturados; Grátis cancelava sem aviso | "Sua assinatura" (período, próxima cobrança e a base do preço, mudança programada) → "Mudar de plano" com previsão antes de confirmar → "Faturas" (período, estorno, revisão) |
| IA (`ia-orcamento.ts`, `ia.ts`) | sem limite | reserva atômica do pior caso, tetos (padrão zero), Grátis bloqueado, cache, limites de documento, livro `UsoIa`, emergência |
| Avisos (`central-avisos.ts`) | lista de mensagens | eventos de negócio com urgência, situação atual e atalho conferido no banco; filtros; histórico por canal |
| Passo 3 | 7 campos por linha | sub-linha com rótulos, recolhida quando completa, "usar esta fonte nas outras linhas" |
| Site | margens e grade quebradas | margens corretas em 7 páginas, grade sem coluna vazia, calculadora com os preços da cobrança, sem quadro vazio |
| Funil (`eventos.ts`) | sem intenção, pagamento e cancelamento | `contrato_cadastrado`, `cobranca_aberta`, `pagamento_confirmado`, `renovacao_cancelada` (motivo opcional como categoria) |

Migração aditiva: `20261124120000_protecao_financeira` (colunas novas em Conta, Fatura e EventoCobranca; tabelas UsoIa e CacheIa; backfill das faturas antigas a partir da descrição gravada pelo próprio sistema).

## C. Auditoria financeira

Ver [COBRANCA.md](COBRANCA.md) (política, webhook, testes, riscos) e [IA.md](IA.md) (preços, custo por documento, projeções 10/50/100 clientes, proposta de cotas). Resumo: **nenhuma chamada paga de IA acontece hoje** (orçamentos em zero); o pior caso de gasto mensal fica limitado pelo teto global que o dono definir.

## D. Auditoria visual

- Capturas reais em 5 resoluções (1440×900, 1920×1080, 768×1024, 390×844, 375×667): **282 antes** (build de `697711f`) e **297 depois**, em `D:\Equapar\capturas-auditoria\{antes,depois}` (fora do git pelo tamanho).
- Comparação lado a lado: `D:\Equapar\capturas-auditoria\comparacao.html` (`node e2e/comparacao.mjs <pasta>`).
- Problemas restantes observados: a landing ainda é longa (10 seções); o passo 3 continua denso em telas pequenas por natureza (planilha); faixas escuras centradas usam largura própria (decisão de estilo mantida).

## E. Testes

| Comando | Resultado |
|---|---|
| `npm run lint` · `npm run typecheck` | ok |
| `npm test` | 322 ok |
| `npm run test:db` | 359 ok (inclui 13 de assinatura e 12 de orçamento de IA no banco) |
| `npm run build` | ok |
| `npm run e2e` | 94 ok |
| `npm run e2e:auditoria` (D, E, F, G) | 12 ok |
| `npm run e2e:financeiro` | 23 ok |
| `npm run e2e:a11y` | 105 verificações, 0 violações graves |
| `npm run e2e:teclado` | 14 ok |
| `e2e/sem-rolagem-lateral.mjs` | 39 ok |
| `e2e/fase2.mjs`, `e2e/jornada.mjs` | 10 e 13 ok |
| `e2e/modo-piloto.mjs` | 8 ok; a 9ª compara com a execução anterior no modo oposto (rodar ligado e desligado em seguida) |

Cenários: A (Raio-X → conta → próximo passo: `e2e:fluxo`), B (contrato e prazo: `e2e`), C (pedido completo: `e2e` e `e2e:financeiro`), D, E, F e G (`e2e:auditoria` e testes de banco), H (concorrência: testes de banco de webhook, renovação e IA), I (permissões no servidor: `exigir` em todas as ações; ações de cobrança exigem `gerenciar_conta`), J (5 resoluções + sem rolagem lateral), K (demonstração isolada: `bloqueadoras/c6`), L (falhas: IA com erro/tempo esgotado, upload inválido nos testes existentes). **Não medido nesta rodada:** Core Web Vitals (a medição anterior, LCP 2,67 s, segue em `docs/pronto/RELATORIO.md`; medir de novo em produção).

## F. Recomendações comerciais (máximo cinco, por impacto)

1. **Definir o ICP como "empresa de limpeza/portaria com 2 a 30 contratos públicos e 50 a 500 postos".** Abaixo de ~75 postos todos pagam o mínimo de R$ 297, o que encarece a entrada para quem tem um contrato; acima de 500, a Assessoria ou um preço negociado faz mais sentido. *Validação barata:* contar no levantamento do PNCP quantas das 1.447 empresas caem em cada faixa.
2. **Medir a ativação como "primeira memória de cálculo aprovada em até 14 dias da conta criada"** (é o primeiro valor real entregue; o Raio-X é atração). Os eventos já existem (`conta_criada`, `memoria_aprovada`); falta só o painel cruzar por conta.
3. **Decidir o crédito do upgrade e a devolução** (hoje: sem crédito automático, devolução manual). É a objeção mais provável de quem já pagou e quer subir de plano.
4. **Aprovar as cotas de IA da tabela de IA.md** depois de uma avaliação real com o gabarito: custo típico de ~US$ 1,37 por cliente/mês contra R$ 297 de receita mínima (cerca de 2,5%).
5. **Testar o Piloto como porta de entrada da Carteira:** cobrar o Piloto e abater o valor nos primeiros meses da Carteira (hipótese a validar com 3 a 5 clientes; não implementado, porque muda preço).

Não alterei nenhum preço. Taxas do gateway, hospedagem e suporte não foram estimadas com valores (faltam os contratos reais); a planilha de cenários de IA está em `npm run custo:ia`.

## G. Pendências

| Depende de | Item |
|---|---|
| Decisão comercial | crédito em upgrade; devolução após cancelamento/estorno parcial; cotas de IA; preço por faixa de postos |
| Credenciais externas | sandbox do Asaas (testar webhook real); chave da Anthropic com orçamento de avaliação |
| Integração real | renovação com cobrança automática no cartão (`/subscriptions` do Asaas), se desejado |
| Dados ainda não disponíveis | precisão por modelo (avaliação paga); custo real por documento (livro `UsoIa` depois de ligar); Core Web Vitals em produção |
