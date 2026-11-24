# IA: proteção financeira, custos e proposta de cotas (P0)

Código: `src/lib/ia-orcamento.ts` (orçamento, preços, reservas), `src/lib/ia.ts` (toda chamada paga passa por `executarComOrcamento`), `src/lib/ia-acesso.ts` (quando a IA aparece), `scripts/custo-ia.ts` (`npm run custo:ia`).

## Defeitos encontrados (antes)

| # | Defeito | Consequência |
|---|---|---|
| I1 | Nenhum limite por conta, plano, usuário ou global | Com a chave ligada, qualquer conta (inclusive Grátis) gerava gasto ilimitado |
| I2 | Nenhum registro de consumo | Sem como saber custo por conta nem auditar |
| I3 | PDF de qualquer tamanho e páginas | Uma chamada podia custar vários dólares |
| I4 | Tentativas automáticas do SDK (até 2 a mais) fora de controle | Cada tentativa paga sem saber |
| I5 | Mesmo documento lido de novo era pago de novo | Gasto repetido |
| I6 | Sem desligamento de emergência | — |
| I7 | Script de avaliação chamava a API sem teto | — |

Pontos que chamam modelos pagos (auditados): `lerPlanilhaPdf` (passo 2), `lerConvencaoPdf` (passo 3) e `scripts/avaliar-ia-convencao.ts`. Não há chamadas em segundo plano nem reprocessamento automático.

## Como funciona agora

1. **Padrão é zero.** `IA_ORCAMENTO_GLOBAL_USD_MES` e os tetos por plano vêm vazios: nenhuma chamada paga acontece e a opção nem aparece na tela. **Grátis é sempre zero.** `IA_DESLIGADA=true` desliga tudo na hora.
2. **Cache por conta:** mesmo documento + operação + modelo + instruções → resultado reaproveitado, custo zero (registrado como `CACHE`).
3. **Limites do documento:** 10 MB e 40 páginas (contadas com pdf-lib antes de chamar).
4. **Reserva atômica** antes de cada tentativa (`pg_advisory_xact_lock` global): soma o gasto do mês (real quando conhecido, reservado quando não) da conta e do SaaS, confere concorrência (1 por conta, 4 no total), limite diário do usuário (10 em 24 h) e só então grava a reserva do **pior caso** (páginas × 4.000 tokens + instruções + 16.000 de saída, × 1,2).
5. **Consolidação:** o custo real (tokens informados pela API, com cache) substitui a reserva e libera a diferença.
6. **Falhas:** erro devolvido pela API = custo zero; tempo esgotado ou conexão caída = custo incerto, conta o reservado. Repetição só para 429/529/5xx/tempo esgotado, no máximo 2 tentativas, com espera crescente; cada tentativa tem a sua reserva. SDK com `maxRetries: 0`.
7. **Reserva esquecida** (processo caiu): expira em 15 minutos contando o valor reservado (rotina de hora em hora).
8. **Livro `UsoIa`:** conta, usuário, operação, modelo, mês, status, custo reservado e real, tokens (entrada, saída, cache), bytes, páginas, hash do documento, duração, tentativa, erro. Não guarda o documento, o texto nem a chave.

Para o usuário: sem orçamento, a tela não oferece IA e o caminho manual (Excel ou digitação) segue igual. Com orçamento, um bloqueio diz o motivo (cota do mês acabou e quando renova, documento grande demais, outra leitura em andamento, limite diário) e a alternativa manual.

## Preços usados (US$ por milhão de tokens, página de preços da Anthropic, 24/11/2026)

| Modelo | Entrada | Saída | Leitura de cache | Escrita de cache (5 min) |
|---|---|---|---|---|
| Opus 5.5 (em uso) | 4 | 20 | 0,20 | 5 |
| Sonnet 5.5 | 2 | 10 | 0,10 | 2,50 |
| Haiku 5.5 (até 100 mil de entrada) | 0,10 | 0,50 | 0,01 | 0,125 |
| Haiku 5.5 (acima de 100 mil) | 0,50 | 2,50 | 0,05 | 0,625 |

## Custo estimado por documento (`npm run custo:ia`)

Premissas: ~2.500 tokens por página de PDF, saída proporcional às linhas, câmbio R$ 5,40. **São estimativas**: o custo real de cada leitura fica no livro e deve substituí-las.

| Documento | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 | Reserva de pior caso (Opus) |
|---|---|---|---|---|
| Planilha, 4 páginas (3 postos) | US$ 0,186 (R$ 1,00) | US$ 0,093 | US$ 0,005 | US$ 0,478 |
| Planilha, 12 páginas (8 postos) | US$ 0,426 (R$ 2,30) | US$ 0,213 | US$ 0,011 | US$ 0,631 |
| Convenção, 25 páginas | US$ 0,312 (R$ 1,68) | US$ 0,156 | US$ 0,008 | US$ 0,881 |
| Convenção, 40 páginas | US$ 0,472 (R$ 2,55) | US$ 0,236 | US$ 0,059 | US$ 1,169 |

Por cliente no mês (Opus): leve (1 planilha + 1 convenção) US$ 0,50 (0,9% de R$ 297); típico (4 + 2) US$ 1,37 (2,5%); intenso (15 + 6) US$ 4,66 (8,5%).

Projeção (mix 60% leve, 30% típico, 10% intenso): 10 clientes US$ 11,75/mês; 50 clientes US$ 58,77; 100 clientes US$ 117,54. Um cliente abusivo para no teto da conta; o teto global corta qualquer soma.

## Comparação de modelos

**A precisão não foi medida**: exige chamadas pagas, que não foram autorizadas. O que existe:
- o harness de avaliação (`scripts/avaliar-ia-convencao.ts`, gabarito em `fixtures/gabarito-convencoes.json`) agora passa pelo orçamento (`IA_ORCAMENTO_AVALIACAO_USD_MES`) e usa o modelo de `IA_MODELO`: rodar uma vez por modelo compara acertos, erros, omissões, confiança baixa, tempo e custo;
- a recomendação é **manter o Opus 5.5** até a avaliação: o custo por leitura é baixo frente ao preço do plano, e um erro de extração custa mais que a diferença. O Haiku é 40× mais barato: vale avaliar para a planilha (texto tabular) antes de qualquer troca.

## Proposta de cotas (para aprovação; hoje tudo em zero)

Premissas: câmbio R$ 5,40 por US$; custo típico por cliente de US$ 1,37/mês (4 planilhas + 2 convenções, Opus 5.5); preços atuais da página (não alterados). "Margem após IA" considera **só** o custo de IA; hospedagem, gateway, e-mail e suporte não entram porque ainda não têm valor contratado.

| Plano | Receita/mês | Teto de IA por conta | Teto em R$ | Pior caso (teto ÷ receita) | Uso típico (R$) | Margem após IA, uso típico | Margem após IA, no teto |
|---|---|---|---|---|---|---|---|
| Grátis | R$ 0 | US$ 0 | R$ 0 | — | — | — | — |
| Piloto | R$ 1.500 por pedido | US$ 5 | R$ 27,00 | 1,8% | R$ 7,40 | 99,5% | 98,2% |
| Carteira (mínimo, ≤ 74 postos) | R$ 297 | US$ 5 | R$ 27,00 | 9,1% | R$ 7,40 | 97,5% | 90,9% |
| Carteira (200 postos) | R$ 800 | US$ 5 | R$ 27,00 | 3,4% | R$ 7,40 | 99,1% | 96,6% |
| Assessoria | R$ 1.497 | US$ 20 | R$ 108,00 | 7,2% | R$ 29,60 (4 clientes) | 98,0% | 92,8% |
| **Teto global do SaaS** | — | **US$ 150/mês no início** | R$ 810 | corta qualquer soma | — | — | — |

Leitura: o perfil intenso (US$ 4,66) cabe no teto de US$ 5 da Carteira; acima disso a conta vê "a cota do mês acabou, renova em …" e continua pelo Excel ou digitando. O pior caso por conta é conhecido e limitado; o global protege contra muitas contas no teto ao mesmo tempo (30 contas no teto da Carteira já somam US$ 150).

Para ligar: (1) aprovar ou ajustar esta tabela; (2) rodar a avaliação com o gabarito conferido e um orçamento de avaliação (ex.: `IA_ORCAMENTO_AVALIACAO_USD_MES=10`) para medir precisão e custo real por documento; (3) só então definir `IA_ORCAMENTO_*` e `IA_LEITURA_*`. Depois de um mês, substituir as premissas pelo custo real do livro `UsoIa`.

## Testes (cliente falso, nenhuma chamada paga)

`src/lib/ia-orcamento.test.ts` (preços, pior caso, bloqueios) e `src/lib/ia-orcamento.db.test.ts` (banco, limites fictícios de US$ 1 por conta e US$ 2 global):
1. muitas leituras: a conta esbarra no teto e para; gasto total ≤ teto;
2. **20 reservas simultâneas** da mesma conta: soma reservada ≤ teto da conta;
3. mesmo documento de novo: cache, sem nova chamada;
4. erro 500: custo zero, uma nova tentativa, conclui;
5. tempo esgotado: custo incerto conta o reservado; desiste no limite;
6. Grátis: bloqueado antes de qualquer chamada;
7. downgrade: o plano vem da conta no servidor (Grátis → bloqueado; ver 6);
8. inadimplente: conta somente leitura não executa ações de edição (`exigir` em `lib/auth.ts`), logo não lê com IA;
9. burlar pelo backend: plano e custo vêm do servidor; o navegador não envia valores de consumo;
10. **várias contas ao mesmo tempo**: soma ≤ teto global;
e mais: erro 400 não repete, reserva esquecida expira, orçamento zero (padrão) não chama.
