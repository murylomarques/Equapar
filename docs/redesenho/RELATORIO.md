# Relatório do redesenho de UX e acabamento (branch `redesenho-ux`)

Data: 12/11/2026. Todos os dados de exemplo são fictícios. Nada foi publicado, implantado ou enviado a serviços externos.

- Linha de base: `docs/redesenho/AUDITORIA.md` e `docs/redesenho/antes/`
- Depois: `docs/redesenho/depois/` (104 capturas: 1440×900 e 390×844)
- Lado a lado: `docs/redesenho/comparacao.html` (abra no navegador; alterna computador e celular)
- Acessibilidade: `docs/redesenho/acessibilidade.json`; Lighthouse: `docs/redesenho/lighthouse/`

## 1. Verificação (seção 12 do prompt)

| # | Critério | Resultado | Prova |
| --- | --- | --- | --- |
| 1 | Todos os testes passam | **Cumprido.** 31/31 testes de unidade; motor de cálculo sem mudança (mesmos testes de antes) | `npm test` |
| 2 | Testes novos de máscaras e conversões | **Cumprido.** `src/lib/mascaras.test.ts` (CNPJ, dinheiro, percentual, inteiro, data, relativo, plural, navegador) | `npm test` |
| 3 | E2E no computador e no celular: Raio-X, primeiros passos, cadastrar contrato, pedido em 5 passos, protocolo, deferido, recebido, configurações de avisos | **Cumprido.** 22 etapas em 1440×900 e as mesmas 22 em 390×844 (com checagem de rolagem lateral e de erros no console); assessoria + 2FA: 7 etapas | `npm run e2e` (`e2e/fluxo.mjs desktop`, `e2e/fluxo.mjs celular`, `e2e/assessoria-2fa.mjs`) |
| 4 | axe-core em todas as rotas, sem violação séria ou crítica | **Cumprido.** 46 rotas × 2 tamanhos = 92 páginas: **0 violações de qualquer nível** (WCAG 2.1 A/AA) | `npm run e2e:a11y` → `acessibilidade.json` |
| 5 | Teste só com teclado; reduzir movimento | **Cumprido, de forma automatizada.** Pular para o conteúdo, Raio-X, entrar, menu da conta (Enter, setas, Esc devolve o foco), atalho "/", e anel de foco visível em cada parada de Tab de 9 telas. Reduzir movimento: na landing nada passa de 100 ms nem entra deslizando (o spinner continua girando). Observação: foi um roteiro de teclado executado pelo navegador, não uma sessão manual de uma pessoa com leitor de tela | `npm run e2e:teclado`; `npm run e2e:a11y` |
| 6 | Lighthouse celular na landing: LCP ≤ 2,5 s, CLS ≤ 0,1, acessibilidade ≥ 95 | **Parcial.** CLS 0 a 0,003 ✔; acessibilidade 100 ✔ (boas práticas 100, SEO 100). **LCP: 2,9 s na mediana de 5 execuções no modo padrão (simulado)** ✘; 1,7 / 2,0 / 2,4 s com o mesmo perfil de rede e CPU aplicado de verdade (`--throttling-method=devtools`) ✔. Ver a explicação abaixo | `docs/redesenho/lighthouse/` |

### Por que o LCP não fecha no modo padrão do Lighthouse

- Medido em `localhost`, num computador de desenvolvimento ocupado. Todos os scripts chegam em ~180 ms e rodam antes da primeira pintura; o modo simulado então conta todo o JavaScript (React incluído) como dependência do LCP. Com a rede e a CPU lentas aplicadas de fato, a página pinta antes, e o LCP fica entre 1,7 e 2,4 s.
- O que foi feito para baixar o LCP (de 3,2 s para 2,9 s simulado; de 3,1–4,0 s para 1,7–2,4 s aplicado):
  1. Site público agora é **estático** (antes era renderizado a cada visita porque o topo lia a sessão). O botão "Entrar" / "Abrir a Equapar" passou a checar a sessão no navegador por `/api/sessao`, que só devolve `{ logado: true|false }`.
  2. Seções abaixo da dobra com `content-visibility: auto`: o primeiro cálculo de layout ficou bem menor.
  3. CSS embutido no HTML (`experimental.inlineCss` do Next; o CSS tem ~9 KB comprimido).
- **Próximo passo recomendado**: medir de novo na URL de produção (PageSpeed Insights). Se ainda passar de 2,5 s, o próximo corte é reduzir o JavaScript da landing (hoje ~150 KB comprimidos, a maior parte é o próprio React).

## 2. Mudanças por tela

| Nº | Tela | O que mudou |
| --- | --- | --- |
| 01 | Landing | Seções sempre visíveis (B1); entrada suave só ao rolar; números de fatos com fonte; telas reais com dados fictícios; tabela de comparação; calculadora de preço por posto; estático e mais rápido |
| 02–04 | Raio-X | CNPJ com máscara e validação ao sair do campo; resultado em etapas ("Consultando o PNCP…"); depois de 30 s oferece receber por e-mail; mensagem honesta quando o PNCP está fora; estados vazio e de erro |
| 05 | Preços | Calculadora por posto, mínimos claros, "Preços em teste" |
| 06–10 | Assessorias, guias, privacidade, termos | Tipografia e espaçamento novos; menu do site no celular com foco preso e Esc (B14) |
| 11–12 | Entrar / criar conta | Senha com "mostrar" e regras; "Lembrar de mim" (12 h sem marcar); progresso em etapas no criar conta; sem texto de desenvolvedor sobre o Google (B8): o botão só aparece se o Google estiver configurado |
| 13 | 404 | Estado vazio com caminho de volta |
| 14 | Hoje | Saudação correta, inclusive de madrugada; cartões de número ("Próximos 30 dias"), corrigindo "0 prazos" (B2); tarefa duplicada removida (B3); linha do tempo de 90 dias; "Tudo em dia" quando não há pendência |
| 15–18 | Primeiros passos | Etapas visíveis; convenção sugerida pela cidade; tela final com o resumo da carteira |
| 19–20 | Carteira | Seleção por caixa, ações em lote, chips com contagem, ordenação por coluna, linha clicável; valores de exemplo variados (B9) |
| 21 | Cadastrar contrato | Blocos (identificação, vigência, valores, reajuste); datas com máscara e calendário em português (B11); inteiros sem `type=number` (B10); "Repactuação / Reajuste por índice" em cartões, sem texto cortado (B7); convenção em busca com lista; resumo de erros com links para cada campo |
| 22–26 | Contrato | Editar em painel lateral; menu "⋯" com arquivar; abas mais claras; histórico com estado vazio |
| 27 | Prorrogação | Os 3 casos com texto direto e dica dos termos jurídicos |
| 28–29 | Pedidos / novo pedido | Chips com contagem, selos de situação, linha clicável |
| 30–34 | Pedido, 5 passos | Barra de passos com o que já foi feito; passo 2 com área de arquivo (B12); passo 3 com abas por posto, módulos recolhíveis com subtotal, colar do Excel, Enter para descer, "só o que mudou", fonte obrigatória na linha alterada, no celular um módulo por vez (B15), salvamento com estados "Salvando… / Salvo às / Não salvou: tentar de novo"; passo 5 com cartões de número e bloqueio claro antes da aprovação |
| 35 | Memória de cálculo | Cabeçalho fixo, filtro "só o que mudou", módulos recolhíveis, comentário por linha, imprimir, confirmação ao aprovar |
| 36–37 | Pedido pronto (protocolado, deferido) | Linha de estados até o dinheiro entrar; carimbos; arquivos para baixar; histórico com texto quando vazio |
| 38 | A receber | Cartões de número e tabela com o que falta (apostilar, faturar, receber) |
| 39 | Convenções | Formulário com máscaras; editar em painel lateral; área de arquivo |
| 40 | Avisos | Lista por tipo; links usam `APP_URL` (B6 depende da configuração de produção) |
| 41 | Busca | Termo destacado, filtro por tipo, atalho "/" |
| 42 | Menu da conta | Fecha com Esc e clique fora, setas navegam (B13); nome acessível "Conta de …" |
| 43–48 | Configurações | Interruptores, canais em lista, sessões legíveis ("Edge no Windows", B17), "Encerrar as outras sessões", logo da assessoria nos PDFs, exportação em segundo plano com acompanhamento; na demonstração o formulário fica travado e sem botão (B16) |
| 49–50 | Clientes (assessoria) | Plural correto (B5); CNPJ com máscara; importação opcional do PNCP |
| 51 | Demonstração | Faixa "Crie sua conta para usar" |
| 52–60 | Celular | Navegação inferior com contadores; sem rolagem lateral em nenhuma tela testada |

Em todo o produto: toasts, resumo de erros com foco, botão de envio com "…ndo" e sem clique duplo, barra de progresso de navegação (após 300 ms), esqueletos por rota (após 400 ms), janela de confirmação, dicas para termos jurídicos.

## 3. Bugs

| Bug | Situação |
| --- | --- |
| B1 seções da landing invisíveis sem JS / em captura | Corrigido |
| B2 "0 prazos" na semana | Corrigido |
| B3 tarefa duplicada da convenção | Corrigido |
| B4 sessões acumuladas | Corrigido no código (sessão do mesmo navegador é reaproveitada; vencidas são apagadas no login). Limpeza feita, com sua autorização, só nas contas fictícias: 25 sessões duplicadas removidas |
| B5 plural fixo | Corrigido (`plural()`) |
| B6 links de aviso com `localhost` | Código já usa `APP_URL`; **depende de configurar `APP_URL` em produção** |
| B7 texto cortado no select | Corrigido (cartões de opção) |
| B8 texto de desenvolvedor sobre o Google | Corrigido |
| B9 valores iguais nos exemplos | Corrigido (só os 5 contratos fictícios, com sua autorização) |
| B10 `type=number` | Corrigido |
| B11 data nativa | Corrigido (máscara + calendário em português) |
| B12 "Escolher arquivo" nativo | Corrigido (área de arquivo) |
| B13 menu da conta | Corrigido |
| B14 menu do site no celular | Corrigido |
| B15 passo 3 no celular | Corrigido (um módulo por vez) |
| B16 preferências na demonstração | Corrigido |
| B17 navegador cru nas sessões | Corrigido |

Achados durante a verificação (também corrigidos):

- **Passo 3 bloqueava sem motivo**: ao mudar só o salário base, o servidor exigia fonte também do 13º, do INSS, do FGTS etc., que mudam por consequência. O editor já marcava só a linha mudada à mão; o servidor agora usa a mesma regra. Só validação; o cálculo não mudou.
- Botão da conta com nome acessível diferente do texto visível; tabelas e barras de etapas roláveis sem acesso pelo teclado; itens de menu sem anel de foco.
- Capturas de página inteira no celular com mais de ~16 mil pixels repetiam o topo (limite do navegador). O roteiro de capturas agora divide essas páginas em partes. Isso também acontecia nas capturas "antes".

## 4. Funcionalidades da seção 10

| Item | Situação | Prova |
| --- | --- | --- |
| Raio-X com etapas e e-mail depois de 30 s | Implementado | capturas 02–04; E2E "Raio-X" |
| Landing visível sem JS | Corrigido | captura 01; `Revelar` não esconde nada |
| Calculadora de preço por posto | Implementado | captura 05 |
| Senha com mostrar/regras, "Lembrar de mim", progresso | Implementado | capturas 11–12 |
| Hoje: cartões, linha do tempo, "Tudo em dia" | Implementado | captura 14 |
| Carteira: seleção, chips, ordenação | Implementado | capturas 19–20 |
| Contrato em painel lateral, "⋯" com arquivar | Implementado | capturas 22–26 |
| Assistente: abas, módulos, colar, só o que mudou, fonte obrigatória, celular por módulo | Implementado | capturas 30–34; E2E passo 3 |
| Memória: cabeçalho fixo, filtro, módulos, impressão, confirmação | Implementado | captura 35; E2E |
| Busca: destaque, filtro, "/" | Implementado | captura 41; teste de teclado |
| Configurações: interruptores, sessões, encerrar outras, exportação em segundo plano | Implementado | capturas 43–48; E2E avisos |
| Logo da assessoria nos PDFs | Implementado | `lib/pdf.ts`, `api/conta/logo` |
| Toasts, resumo de erros, barra de navegação, esqueletos | Implementado | E2E (toasts e resumo de erros) |
| Dicas para termos jurídicos | Implementado | `Termo` em `ui/estrutura.tsx` |
| Já existiam e continuam passando: 5 passos, documentos, protocolo, resposta, A receber, convenções, avisos, papéis, 2FA, exportar/excluir, assessoria, demonstração | Existe | E2E |

## 5. Banco de dados e dependências

- Migração **aditiva** (autorizada): `20261112012736_logo_assessoria_e_trabalhos_fundo` (campo `Conta.marcaLogo` e tabela `TrabalhoFundo`). Nenhuma coluna removida ou alterada.
- Dados alterados (autorizado): valores mensais dos 5 contratos fictícios; 25 sessões duplicadas de contas fictícias.
- Dependências novas **só de desenvolvimento**: `axe-core`, `lighthouse`. Nenhuma dependência nova de produção.
- Configuração do Next: `experimental.inlineCss: true` (CSS no HTML). Para voltar, basta apagar a linha em `next.config.ts`.
- Rota nova: `GET /api/sessao` (devolve só se há sessão; sem dados pessoais).

## 6. Pendências do dono (não inventei nada disso)

1. **Dados legais da empresa** em `src/lib/site.ts`: razão social, CNPJ, endereço, WhatsApp e nome/foto do fundador estão como `[PREENCHER]` e aparecem assim no rodapé e na landing.
2. **Política de privacidade e termos de uso**: continuam como minuta, com o aviso "Revise com um profissional antes de publicar".
3. **Chaves de serviços** (`.env`): `GOOGLE_CLIENT_ID/SECRET` (login com Google; o botão some enquanto não houver), `WHATSAPP_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`, `SMTP_URL` e `EMAIL_FROM`. Sem elas, avisos ficam em modo simulação (registrados na tela Avisos).
4. **Domínio e `APP_URL` de produção**: os links dos avisos usam `APP_URL` (B6). O e-mail `contato@equapar.com.br` exibido no site também depende do domínio.
5. **PNCP**: a consulta direta é recusada pelo firewall do PNCP a partir deste ambiente. Não contornei. Em produção, verificar com o IP do servidor; o Raio-X mostra uma mensagem honesta quando o PNCP não responde.
6. **Pagamento**: não há gateway integrado; a aba Cobrança só registra o plano.
7. **Medir o LCP em produção** (seção 1 deste relatório).

## 7. Decisões tomadas sem certeza (revise se quiser)

- Animação da landing: 200 ms, 8 px, só ao rolar; com "reduzir movimento", esmaecer de até 100 ms.
- Esqueletos aparecem só depois de 400 ms e a barra de navegação depois de 300 ms, para não piscar em telas rápidas.
- Percentuais no editor com até 4 casas decimais.
- Selo "Mais escolhido" nos preços foi omitido (não há dado que o sustente).
- O vídeo da landing foi trocado por "Ver a tela por dentro", que abre a demonstração.
- "Lembrar de mim" desmarcado = sessão de 12 h que acaba ao fechar o navegador.
- Fonte obrigatória só nas linhas mudadas à mão (não nas que variam por consequência).
- `content-visibility` e CSS embutido para o desempenho da landing.

## 8. Como rodar as verificações

```bash
npm test                      # unidade (31)
npm run build && npm start    # servidor de produção
BASE_URL=http://localhost:3000 npm run e2e        # fluxo no computador e no celular + assessoria/2FA
BASE_URL=http://localhost:3000 npm run e2e:a11y   # axe em todas as rotas + reduzir movimento
BASE_URL=http://localhost:3000 npm run e2e:teclado
node e2e/capturas.mjs docs/redesenho/depois && node e2e/comparacao.mjs
```

O E2E cria uma conta de teste `e2e-…@exemplo.local` e a apaga no fim; o Raio-X usa um CNPJ fictício em cache.
