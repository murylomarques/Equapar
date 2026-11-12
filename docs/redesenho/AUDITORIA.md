# Auditoria (Fase 0): linha de base antes do redesenho

Data: 11/11/2026 · branch `redesenho-ux` · commit de partida `645192c`

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript 5 |
| Dados | PostgreSQL 17 (Docker, porta 5440), Prisma 6 |
| CSS | CSS próprio com variáveis (`src/app/globals.css`, `app.css`, `site.css`), sem Tailwind |
| Componentes | Próprios, sem biblioteca de UI. Ícones Lucide |
| Formulários | Server Actions + `useActionState` (`FormAcao`), validação com zod no servidor |
| Documentos | pdf-lib, docx, exceljs, jszip |
| Testes | Vitest (16 testes de unidade: motor e leitura de Excel) e Playwright via `playwright-core` (`e2e/`) |

Testes na linha de base: **16 de 16 passando** (`npm test`). Ponta a ponta (`npm run e2e`): 19 de 19 e 7 de 7 na última execução.

## Rotas (60 telas numeradas)

| Nº | Rota | Nº | Rota |
| --- | --- | --- | --- |
| 01 | `/` | 27 | `/app/contratos/[id]/prorrogacao` |
| 02–04 | `/raio-x`, `?cnpj=` (resultado, inválido) | 28 | `/app/pedidos` |
| 05 | `/precos` | 29 | `/app/pedidos/novo?contrato=` |
| 06 | `/assessorias` | 30–34 | `/app/pedidos/[id]/passo/[1-5]` |
| 07–08 | `/guias`, `/guias/[slug]` | 35 | `/app/pedidos/[id]/memoria` |
| 09–10 | `/privacidade`, `/termos` | 36–37 | `/app/pedidos/[id]/pronto` (protocolado, deferido) |
| 11–12 | `/entrar`, `/criar-conta` (+ `/entrar/2fa`) | 38 | `/app/a-receber` |
| 13 | 404 | 39 | `/app/convencoes` |
| 14 | `/app/hoje` | 40 | `/app/avisos` |
| 15–18 | `/app/boas-vindas?passo=` | 41 | `/app/busca` |
| 19–20 | `/app/carteira` (+ filtros) | 42 | menu da conta |
| 21 | `/app/contratos/novo` | 43–48 | `/app/configuracoes?aba=` |
| 22–26 | `/app/contratos/[id]?aba=` | 49–50 | `/app/clientes` (assessoria) |
| | | 51 | `/demonstracao` → `/app/hoje` (só leitura) |
| 52–60 | as mesmas rotas a 390×844 | | |

Rotas de servidor: `/api/raio-x/relatorio`, `/api/pedidos/[id]/arquivos/[tipo]`, `/api/documentos/[id]`, `/api/exportar`, `/api/auth/google(/callback)`, `/api/whatsapp/webhook`, `/api/cron/avisos`, `/api/avisos/[id]/aberto`, `/r/[id]`.

Capturas da linha de base: `docs/redesenho/antes/` (102 arquivos, desktop e celular), geradas por `node e2e/capturas.mjs docs/redesenho/antes`.

## Componentes de formulário existentes

- Campos HTML nativos com estilo global. Datas usam `<input type="date">` nativo; postos, ano e quantidade usam `type="number"`.
- `FormAcao`: formulário ligado a uma Server Action, com erro e confirmação em texto abaixo.
- `BotaoEnvio`: troca o texto por "Aguarde…"/gerúndio e desabilita. Sem spinner, sem `aria-busy` coerente em todos.
- `FormCnpj` (landing e Raio-X): valida ao enviar, sem máscara.
- `ZonaArquivo` (passo 2): arrastar e soltar simples. Nos outros envios aparece o `<input type="file">` nativo.
- `EditorPlanilha`: tabela única com todas as linhas, inputs crus, sem módulos recolhíveis.
- `Copiar`, `DoisFatores`, `SeletorEmpresa`, `Revelar`.
- Não existem: máscara de dinheiro, máscara de data, combobox, interruptor, radio em cartão, toast, resumo de erros, painel lateral, menu "⋯", estado vazio padronizado.

## Como o carregamento funciona hoje

- Navegação entre páginas: nenhum indicador (a página antiga fica parada até a nova chegar).
- Envio de formulário: só o botão muda de texto. A área que vai mudar não mostra estado.
- Raio-X: `Suspense` com esqueleto de 3 linhas e "Consultando o PNCP. Leva até 10 segundos." Sem etapas, sem oferta de aviso por e-mail depois de 30 s.
- Salvamento automático do editor: "Salvo às HH:MM" (sem "Salvando…" nem "Não salvou").
- Não há `loading.tsx` em nenhuma rota, toasts, nem mínimo de 500 ms.

## Bugs encontrados

| # | Tela | Bug | Origem |
| --- | --- | --- | --- |
| B1 | 01, 52 | Seções abaixo da dobra com `opacity: 0` até o IntersectionObserver rodar: somem sem JavaScript e em capturas de página inteira (9 seções medidas com opacidade 0 ao carregar) | seção 9 do prompt, confirmado |
| B2 | 14 | "Esta semana: 0 prazos" enquanto a lista mostra prazos em 10 e 18 dias (contava só ≤7 dias) | seção 9, confirmado |
| B3 | 14 | Tarefa duplicada para o 19/2025: "Informar a convenção coletiva" (regra) e "Descobrir a convenção" (tarefa) | seção 9, confirmado |
| B4 | 47 | Sessões acumuladas: 16 da demonstração e 12 do dono fictício. Cada login cria uma sessão nova, sem reaproveitar a do mesmo navegador e sem limpar as vencidas | seção 9, confirmado |
| B5 | 49–50 | "1 clientes", "1 contratos": plural fixo | seção 9, confirmado |
| B6 | 40 | Links dos avisos com `http://localhost:3100`. O código já usa `APP_URL`; o valor veio do servidor de teste. Falta documentar e validar o `APP_URL` em produção | seção 9; causa: ambiente |
| B7 | 21 | Texto da opção "Repactuação (convenção coletiva)" cortado no select | seção 9, confirmado |
| B8 | 11–12 | Mensagem de desenvolvedor: "Entrar com Google fica disponível quando a integração for configurada" | seção 9, confirmado |
| B9 | 19 | Dados de exemplo: todos os contratos com o mesmo valor mensal (R$ 58.805,66) | seção 9, confirmado |
| B10 | 21, 33, 39 | `type="number"` em postos, ano e quantidade (perde caracteres e muda com a rolagem do mouse) | P8 |
| B11 | 21, 30, 39 | `<input type="date">` nativo, com aparência e idioma variando por navegador | 5.1 |
| B12 | 25, 33, 39 | "Escolher arquivo · Nenhum arquivo escolhido" nativo | 5.1 |
| B13 | 42 | Menu da conta (`<details>`) não fecha com Esc nem com clique fora | seção 9 |
| B14 | 53 | Menu do site no celular sem foco preso, sem Esc, sem fechar ao tocar fora | seção 9 |
| B15 | 58 | Passo 3 no celular: dois postos × ~25 linhas com 4 campos cada, empilhados (página de ~5.700 px) | seção 9 |
| B16 | 51 | Na demonstração, o formulário de preferências de aviso aparece habilitado (a ação recusa, mas o botão está lá) | revisão |
| B17 | 47 | Sessão mostrada com a string crua do navegador | seção 9 |

## Funcionalidades que faltam ou estão incompletas (seção 10)

| Item | Situação na linha de base |
| --- | --- |
| Raio-X com carregamento por etapas e "avisar por e-mail" depois de 30 s | Falta (há aviso por e-mail só no erro) |
| Landing visível sem JavaScript | Bug B1 |
| Calculadora de preço por posto | Falta |
| Senha com mostrar e regras, "Lembrar de mim", progresso no criar conta | Falta |
| Hoje: cartões de número, linha do tempo agrupada, "Tudo em dia" | Falta |
| Carteira: seleção por checkbox, chips com contagem, ordenação | Parcial (lote por convenção existe como faixa) |
| Contrato: editar em painel lateral, "⋯" com arquivar | Falta (formulário sempre aberto) |
| Assistente: abas por posto, módulos recolhíveis com subtotal, colar do Excel, "só o que mudou", fonte obrigatória na linha alterada, celular por módulo | Falta |
| Memória: cabeçalho fixo, filtro, módulos recolhíveis, impressão, confirmação ao aprovar | Parcial |
| Busca: termo destacado, filtro por tipo, atalho "/" | Falta |
| Configurações: interruptores, sessões legíveis, "Encerrar as outras sessões", radio em cartão, exportação em segundo plano | Falta |
| Logo da assessoria nos PDFs | Falta |
| Toasts, resumo de erros, barra de navegação, esqueletos por rota | Falta |
| Dicas para termos jurídicos | Falta |

Já existem e foram testados: os 5 passos com salvamento automático, os documentos (Word, PDF, Excel, ZIP), protocolo, resposta, A receber, convenções, avisos (60/30/7, resposta, deferido, semanal, SAIR, simulação), papéis, 2FA, exportar e excluir, assessoria com seletor, demonstração e os 16 eventos de métricas.
