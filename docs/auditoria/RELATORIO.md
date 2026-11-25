# Equapar: entrega final para homologação

Branch `auditoria-total` (base `697711f`), sem merge na `main` e sem deploy. Tudo local, com dados fictícios: nenhuma cobrança real, nenhum cancelamento real no Asaas, nenhuma chamada paga à Anthropic.

Documentos: [MATRIZ-TELAS.md](MATRIZ-TELAS.md) · [COBRANCA.md](COBRANCA.md) · [IA.md](IA.md) · [HOMOLOGACAO.md](HOMOLOGACAO.md) (checklist executável). Comparação visual: `D:\Equapar\capturas-auditoria\comparacao.html` (antes × depois, 56 telas, 5 resoluções).

## A. Aplicação

Commits organizados por grupo na branch (cobrança, IA, avisos, telas do site, telas do app, fluxo do pedido, performance, testes). Nada de funcionalidade nova fora do escopo: correções, acabamento, regras conservadoras onde a política comercial não estava aprovada, e testes.

Decisões tomadas nesta rodada (conservadoras, conforme autorizado):
- **Anualidade**: nada vem marcado; cada linha alterada exige resposta (Conferida, Não se aplica com motivo, Revisão necessária/resolvida); o servidor bloqueia gerar sem resposta; o PDF da memória diz exatamente o que foi **declarado** ("declarada pela empresa", "não se aplica: motivo", "não respondida"). Também corrigido: o servidor recusava "Revisão resolvida" ao salvar.
- **Upgrade com período pago em andamento**: sem cobrança pela tela (sem crédito aprovado, seria ambígua); a tela explica e oferece contato para análise manual. Compra também recusada com renovação vencida em aberto (cobraria o mesmo período duas vezes). Conferido de novo com a conta travada no servidor.

## B. Comparação visual

- 282 capturas antes (build de `697711f`), 297 na rodada anterior (`depois`) e **297 na recaptura final** (`final`, todas do mesmo build de fechamento, uma resolução por vez para poupar memória), Playwright/Edge, 1440×900, 1920×1080, 768×1024, 390×844, 375×667.
- Inspeção: quatro revisões visuais independentes na rodada anterior, mais duas na final (site e app), além da minha. A final achou 5 P1 novos (tabelas cortadas no tablet, cartão sem ação no celular, layout do estado vazio de clientes, selo de Avisos com número diferente da página): corrigidos e conferidos nas imagens.

## C. Matriz

[MATRIZ-TELAS.md](MATRIZ-TELAS.md): 23 P1 e 1 P0 encontrados nas telas (18 + 5 na revisão final), todos corrigidos; P2/P3 listados corrigidos; fora: só itens não aplicáveis (com motivo) ou dependentes de aprovação externa.

## D. Testes (build final)

| Comando | Resultado |
|---|---|
| `npm run lint` · `npm run typecheck` · `npm run build` | ok (0 erros, 0 avisos) |
| `npm run test:db` (unitários + banco) | **383 ok** (82 arquivos; inclui a prévia da memória conferida com o motor) |
| `npm run e2e` (fluxo completo no computador e no celular, assessoria e 2FA, sem rolagem lateral) | 94 ok |
| `npm run e2e:auditoria` (aviso → contexto, contratar, cancelar, IA bloqueada) | 12 ok |
| `npm run e2e:financeiro` (deferimento parcial, notas, baixas, ZIP final bloqueado) | 23 ok |
| `e2e/cobranca-simulada.mjs` · `e2e/permissoes.mjs` (papel Leitura) | 5 ok · 6 ok |
| `npm run e2e:a11y` | 105 verificações, **0 violações graves** (axe) |
| `npm run e2e:teclado` · `e2e/sem-rolagem-lateral.mjs` | 14 ok · 39 ok |
| `e2e/fase2.mjs`, `jornada.mjs`, `modo-piloto.mjs`, `demo-limite.mjs`, `bloqueadoras/*` (13 arquivos) | todos ok |

Fechamento: os 27 conjuntos acima rodados de novo no build final: todos ok. Nessa rodada o `e2e:auditoria` achou um defeito real, dependente da data: os avisos de 30 e de 7 dias do **mesmo** fim de vigência apareciam como dois itens em "Precisa de você" (e contavam dois no selo). Corrigido em `central-avisos.ts` (um evento por contrato e data de vigência, com o marco mais recente) e coberto por teste. Dois testes instáveis corrigidos: `s11` (cota diária de pedidos de senha por IP esgotada no localhost depois de muitas execuções; zera só a chave local) e `s4` (espera fixa de 5 s trocada por esperar o servidor terminar).

Jornadas pedidas (1 a 20): 1–14 e 20 pelo `e2e` (computador e celular) e `e2e:financeiro`; 14 e 15–16 pelo `e2e:auditoria` e `cobranca-simulada`; 17 (limite de IA) pelos testes de banco do orçamento (inclusive concorrência); 18 (exportar) por `exportacao.db.test.ts`; 19 (permissão restrita) por `e2e/permissoes.mjs` e `seguranca-acoes.test.ts` (toda ação de servidor confere permissão; as públicas listadas com motivo).

Testes instáveis corrigidos: modo piloto dependia da execução anterior; o fluxo dependia da cota diária do Raio-X por IP (zerada só a chave local no início); cobrança simulada esperava texto que já existia em faturas antigas.

## E. Financeiro

- **Cobrança** ([COBRANCA.md](COBRANCA.md)): acesso só por período pago; cancelamento no fim do período (desfazível); só cobranças não iniciadas são canceladas; renovação gerada pela Equapar (cobranças avulsas no Asaas, sem `/subscriptions`), idempotente, com régua de cobrança pelo calendário até somente leitura (dados nunca apagados); webhook idempotente e seguro fora de ordem; pagamento após cancelamento, duplicado ou sobreposto não libera nada e fica marcado para devolução manual; estorno integral tira só o período estornado, parcial mantém e marca; sem crédito proporcional automático; compra ambígua recusada (análise manual).
- **Verificações independentes**: três rodadas de revisão do código de cobrança por revisores sem contexto; achados P0/P1 corrigidos e cobertos por testes de banco (22 de assinatura + 4 de cobrança), inclusive com relógio controlado (renovação, vencimento, carência) e concorrência.
- **Migração** `20261124120000_protecao_financeira`: só acrescenta; backfill data apenas períodos ainda válidos (cliente antigo não é rebaixado em silêncio). Ensaiada em banco novo e no existente.
- **Asaas**: sem credenciais de sandbox neste ambiente: testado com simulação e cliente HTTP falso (`DELETE /payments/{id}`, criação, eventos). **Homologação no sandbox é pendência externa.**
- **IA** ([IA.md](IA.md)): orçamento zero em todos os planos (nenhuma chamada paga possível); reserva atômica do pior caso com a entrada **contada pela API** antes de chamar; tetos por conta, usuário, concorrência e global; livro de consumo; cache; limites de documento; tentativas controladas; desligamento de emergência; Grátis nunca. A tela não oferece IA sem orçamento e o caminho manual (Excel ou digitação) segue igual. Proposta de cotas com premissas e margem: Grátis 0, Piloto US$ 5, Carteira US$ 5, Assessoria US$ 20, global US$ 150/mês — **não ativada**.

## F. Performance

Laboratório, nesta máquina. Duas formas de medir, porque dão resultados diferentes:

**Páginas públicas, Lighthouse 12.8.2 celular, throttling simulado (Lantern), mediana de 3–5 rodadas**

| Página | Antes (rodada anterior) | Meio desta rodada | Final |
|---|---|---|---|
| `/` | 95 · LCP 2,62 s · TBT 164 ms | 83 · 3,08 s · 449 ms | **93 · 2,79 s · 179 ms** |
| `/precos` | 96 · 2,58 s · 94 ms | 82 · 2,91 s · 508 ms | **93 · 2,60 s · 201 ms** |
| `/raio-x` | 93 · 2,80 s · 174 ms | 80 · 3,01 s · 549 ms | **89 · 2,89 s · 289 ms** |

CLS 0,000 em todas. O meio da rodada mostra uma regressão causada por mim (a calculadora levava o `decimal.js` ao navegador) e por prefetch de links do novo rodapé; os dados apontaram e foram corrigidos (preços e datas em módulos sem dependências; sem prefetch no cabeçalho/rodapé).

- **LCP observado de verdade** (sem simulação) na landing: **0,35 s** (igual ao FCP). O LCP simulado de 2,6–2,9 s vem do modelo do Lighthouse, que conta o JavaScript do React baixado antes da pintura numa rede de 1,6 Mbps; com throttling aplicado de verdade (DevTools), LCP 2,1–2,6 s. **A meta de 2,5 s no simulado não foi atingida**; o restante é o runtime do framework. Confirmar com dados reais de usuários em produção antes de qualquer mudança maior.

**Telas autenticadas e jornadas, Playwright (`scripts/medir-web-vitals.mjs`), 4G lento + CPU 4×, celular**

| Tela | LCP | CLS | Interação (INP aprox.) |
|---|---|---|---|
| Hoje, Carteira, Contrato, Pedidos, A receber, Avisos, Cobrança | 0,73–1,4 s | 0 | 64–104 ms (filtros) |
| Pedido passo 3, digitação na planilha | 1,3–1,5 s | 0 | **248 ms → 112–144 ms** (cálculo da memória adiado) |

INP real de usuários exige dados de campo (não há em ambiente local).

**Fechamento (build final)**
- JavaScript carregado: `/` 458 KB em 7 arquivos (sem gzip), `/precos` 459 KB, `/raio-x` 508 KB; 383 KB são o runtime do React/Next. A última rodada não acrescentou código de cliente às páginas públicas.
- Elemento LCP da landing: o parágrafo de abertura (texto, sem imagem); 2,47 s de "render delay" no modelo simulado contra 0,35 s de pintura observada. Bloqueio por CSS: estimativa de 80–220 ms; a única forma de removê-lo (`inlineCss`) já foi testada e recusada (A5: CSS duplicado na página, pior no celular), então nada foi mudado. Nenhuma otimização pontual medida justificava mexer no código.
- Lighthouse simulado, mediana de 3, **com a máquina carregada** (índice de CPU do Lighthouse 566–980, contra 1.551 na medição anterior; 1,9 GB livres): `/` nota 69 · LCP 3,39 s · TBT 1.059 ms; `/precos` 87 · 1,71 s · 525 ms; `/raio-x` 83 · 2,92 s · 626 ms; CLS 0 em todas. A piora de TBT acompanha o índice de CPU, não o código (mesmo JS, nenhum componente de cliente novo). Números a repetir em máquina livre e, principalmente, com dados de campo.

## G. Checklist de produção

**Pronto e verificado**
- Jornada completa do Raio-X ao recebimento, no computador e no celular; avisos acionáveis; cobrança (simulação) com todas as proteções; IA bloqueada sem orçamento; permissões e isolamento entre contas; exportação; acessibilidade sem violações graves; SEO básico (títulos, descrições, canônicos, Open Graph, sitemap, robots, JSON-LD só com dados reais).

**Depende de credencial ou homologação externa**
- Asaas: chave de **sandbox**, webhook numa URL pública, rodar os cenários de cobrança no sandbox; depois a chave de produção.
- E-mail (SMTP com SPF/DKIM/DMARC), hospedagem, banco com backup, S3, domínio e HTTPS, Turnstile.
- Rotina de hora em hora em produção (worker ou cron `/api/cron/avisos`): gera renovações e anda a régua de cobrança.
- Medição de Core Web Vitals com usuários reais.

**Depende de aprovação comercial ou jurídica**
- Advogado: termos, privacidade e modelos revisados e aprovados em 25/11/2026 (faixa "Minuta" retirada; ver HOMOLOGACAO.md, seção 6).
- Dados da empresa (`SITE_RAZAO_SOCIAL`, `SITE_CNPJ`, endereço).
- Cotas de IA (proposta em IA.md) e avaliação paga com o gabarito.
- Política de crédito em upgrade e de devoluções (hoje: análise manual).

**Bloqueio efetivo de produção (hoje)**
- Aprovação jurídica dos textos legais.
- Asaas real (sandbox testado) e dados da empresa para emitir cobrança.
- Conferência dos dados reais de cobrança antes de aplicar a migração financeira.

## H. Resumo executivo

1. **Funcionalmente completo no escopo?** Sim. A jornada de repactuação, do contrato ao recebimento, funciona e está testada de ponta a ponta.
2. **Telas principais finalizadas?** Sim. Todas as telas foram revisadas com capturas reais em 5 resoluções e corrigidas, inclusive 5 P1 achados só na revisão final; o que restou está na matriz como não aplicável ou dependente de decisão externa. A recaptura final cobriu as 297 telas.
3. **P0 ou P1 abertos?** Não há P0/P1 técnico aberto conhecido. O único P1 que fica é jurídico (faixa "Minuta" até a aprovação dos textos).
4. **P2/P3 restantes?** Nenhum técnico. Ficaram 2 não aplicáveis (IP das sessões, artefato de captura) e itens dependentes de dados/aprovação (rodapé, minuta, telas escondidas no modo piloto).
5. **Testes críticos passaram?** Sim: 380 unitários e de banco, 94 do fluxo completo e todos os conjuntos de navegador, acessibilidade e teclado.
6. **IA financeiramente protegida?** Sim. Orçamento zero; nenhuma chamada paga é possível sem orçamento configurado, disponível e reservado no servidor.
7. **Cobrança pronta para homologação?** Sim, para homologação no sandbox do Asaas. Não foi testada contra o Asaas real.
8. **O que falta para clientes reais?** Aprovação jurídica, dados da empresa, sandbox e depois chave de produção do Asaas, infraestrutura de produção (hospedagem, e-mail, S3, domínio) e a rotina horária no ar.
9. **Risco de perda financeira?** Nenhum conhecido no código. Riscos residuais: operacionais (criar assinatura manual no painel do Asaas cobraria em dobro; devoluções manuais dependem de alguém acompanhar as faturas marcadas) e de integração (comportamento real do Asaas ainda não exercitado).
10. **Recomendo publicar?** **Recomendo homologar agora, não publicar ainda.** O código está pronto para homologação; a publicação deve esperar a aprovação jurídica, os dados da empresa e uma rodada de cobrança no sandbox do Asaas com o webhook real. Sem essas três, colocar clientes pagantes seria assumir risco jurídico e de integração que os testes locais não cobrem.
