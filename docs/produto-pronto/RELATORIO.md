# Produto pronto: relatório vivo (branch `produto-pronto`)

Atualizado a cada item. Situação: **feito**, **parcial**, **bloqueado** (esperando decisão do dono) ou **pendente**.

## Onde parei

Fase 0 em andamento: C1–C8 feitos; S1–S3 feitos; S4 sem o teste no navegador; S5 feito; próximo: S6. Servidor de teste: `npm run build` e `next start -p 3100` (o `next dev` da porta 3000 é do dono e tem o cliente Prisma antigo em memória). Senha do dono fictício: impressa pelo seed (`npx tsx --env-file=.env prisma/seed.ts`).

## Versão do prompt

Seguindo a versão com L16 (valores no WhatsApp), L17 (registrar prorrogação, depende de migração), 5.5 (leitura da convenção com IA, cronômetro e pesquisa de Sean Ellis, recurso após indeferimento, documentos com versão; reforma tributária fora) e item 12 da seção 8.

## Como os testes rodam

- Unidade: `npm test`.
- Falhas bloqueadoras: `SENHA_DONO=<senha do seed> BASE_URL=http://localhost:3000 node e2e/bloqueadoras/<arquivo>.mjs`. Navegador: Chromium do Playwright por padrão; `NAVEGADOR=msedge` usa o Edge instalado.
- "Antes" de cada correção: o mesmo teste rodado contra o código anterior; o resultado está na coluna Prova.

## Fase 0: falhas bloqueadoras

| Item | Situação | Prova | Pendente |
| --- | --- | --- | --- |
| C1 Planilha nova velha após reenviar a atual | feito | `e2e/bloqueadoras/c1-reenvio-planilha.mjs`: antes, salário 1740 nas duas planilhas depois de enviar a de 1800; depois, ids iguais e salário 1800, com confirmação. `src/lib/pedido-regras.test.ts`. Commit "C1" | — |
| C2 Mudar a base não desfaz a aprovação | feito | `e2e/bloqueadoras/c2-aprovacao-invalida.mjs`: antes, data-base e "contar até" mudavam com a memória ainda aprovada e o pedido em CALCULO_VALIDADO; depois, aprovação desfeita, EM_ANALISE e motivo no histórico. Commit "C2". C2.3: a aprovação grava `hashCalculo` (SHA-256 do JSON canônico da base + `versaoRegra`); PDFs, memória, passo 5 e "Gerar" só mostram/aceitam "aprovada" se o hash atual bater (`pedido-regras.test.ts`). Commit "C2.3" | — |
| C3 Validações do passo 3 podiam ser puladas | feito | `e2e/bloqueadoras/c3-pendencias.mjs`: antes, o pedido era gerado com linha alterada sem fonte e a diferença gravada (3.264,61) divergia da tela (4.955,71); depois, recusa com a pendência e link "Ir ao passo 3", e diferença gravada igual. `pendenciasParaGerar` com testes de unidade. Commit "C3" | — |
| C4 Excel quebra com nomes de posto parecidos | feito | `src/lib/excel-nomes.test.ts` (reproduz o "already exists" com o nome antigo; 12 postos iguais nos 28 primeiros caracteres) e `e2e/bloqueadoras/c4-excel-abas.mjs`: antes, status 409 ao baixar o Excel; depois, 200 com 6 abas distintas. Erros conhecidos na geração agora dizem o motivo real. Commit "C4" | — |
| C5 WhatsApp sem código do país e "SAIR" frágil | feito | `src/lib/telefone.test.ts` (10 a 13 dígitos, com e sem 55, com máscara, DDD inválido; `552799990000` × `+5527999990000`; SAIR/PARAR/STOP sem acento e maiúscula) e `src/app/api/whatsapp/webhook/route.test.ts`: antes, JSON inválido derrubava a rota e "Parar" vindo sem o 9 não encerrava; depois, 400 e encerra. Cadastro (avisos e Raio-X) grava `+55…`; envio usa o número normalizado. Commit "C5" | Corrigir números já gravados: `scripts/normalizar-whatsapp.ts` em simulação (aqui: 0 registros). Rodar com `--aplicar` em produção depende do "ok" do dono (trava 2) |
| C6 Demonstração derruba visitantes e a sessão real | feito | `e2e/bloqueadoras/c6-demo-sessoes.mjs`: antes, 4 falhas (visitante derrubado por outro com o mesmo navegador; a demo encerrava sessões de outros; cliente real perdia a sessão ao abrir /demonstracao); depois, todos continuam logados. `criarSessao` não apaga mais por navegador; `exigir` e `exigirUsuario` bloqueiam a demo num ponto só; `/demonstracao` virou página com botão (POST) e aviso para quem já está conectado. Commit "C6". C6.2: cada visita copia a conta fictícia para uma conta própria (`demo = true`, vence em 4 h); o visitante pode montar pedidos; mensagens sempre simuladas; arquivos até 2 MB; gerenciar conta, senha, duas etapas e sessões bloqueados; avisos pulam contas demo. O mesmo teste agora confere isolamento entre visitantes e nenhum aviso ENVIADO. Commit "C6.2" | Limpeza das contas demo vencidas: `scripts/limpar-demos.ts` em simulação (hoje: 0 vencidas). Ligar com `--aplicar` (ou agendar) depende do "ok" do dono (trava 2) |
| C7 Conta tomada antes de existir | feito | `src/app/api/auth/google/callback/route.test.ts`: antes, o Google se ligava à conta criada com a senha de outra pessoa e a senha continuava valendo (3 falhas); depois, senha anulada se o e-mail não estava confirmado, outras sessões encerradas e aviso por e-mail. `e2e/bloqueadoras/c7-confirmar-email.mjs`: cadastro envia link assinado (24 h), aviso no topo com "Reenviar o link", sem confirmação não recebe avisos. Commit "C7" | — |
| C8 Duas etapas desligavam sem o código | feito | `src/app/app/configuracoes/dois-fatores.test.ts`: antes, `iniciar2fa` sem código gravava `totpAtivo = false` (3 falhas); depois, exige código atual ou senha, o segredo novo fica pendente e só troca ao confirmar. 10 códigos de recuperação (só hashes no banco, uso único; `recuperacao.test.ts`). `e2e/assessoria-2fa.mjs`: troca sem código recusada; código de recuperação entra uma vez. Commit "C8". C8.4 (limite das tentativas do código no banco) entrou com o S1 | — |

## Fase 0: segurança

| Item | Situação | Prova | Pendente |
| --- | --- | --- | --- |
| S1 Limite de tentativas no banco | feito | `src/lib/limite.test.ts`: antes, o teste com as funções antigas mostrou que trocar o X-Forwarded-For zerava o limite do e-mail; depois, tabela `TentativaAcesso` com chaves por e-mail (5 falhas/15 min) e por IP (30), IP só do `TRUSTED_PROXY_HEADER`; conta inexistente compara com hash falso (tempo igual); código das duas etapas também limitado no banco (C8.4). `e2e/bloqueadoras/s1-limite.mjs`. Commit "S1" | Configurar `TRUSTED_PROXY_HEADER` na hospedagem (decisão do dono, item 6 da seção 8) |
| S2 Formulários e rotas públicas | feito | `e2e/bloqueadoras/s2-cotas.mjs`: antes, 4 relatórios (CNPJs diferentes) chegavam ao mesmo e-mail no dia; depois, no máximo 3. Cotas diárias no banco (`cota.ts`, testes de unidade): 3 mensagens por e-mail destino e 10 por IP (relatório e "avisar depois"); 60 consultas por IP na rota do Raio-X (tela própria de limite). Captcha Turnstile em simulação sem chave. Commit "S2" | Chave real do Turnstile (trava 5). Decisão sem certeza: "confirmação simples" = captcha + limite por destino (sem dupla confirmação por e-mail, para não travar o funil) |
| S3 Cabeçalhos de segurança | feito | `e2e/bloqueadoras/s3-cabecalhos.mjs` (equivale a `curl -I`): antes, nenhum cabeçalho; depois, CSP, X-Frame-Options DENY, Referrer-Policy, nosniff, Permissions-Policy, sem X-Powered-By; HSTS só em produção; nenhuma violação de CSP no navegador nas telas principais. Commit "S3" | Decisão sem certeza: páginas estáticas (landing, preços, guias, termos) usam CSP sem nonce (`'unsafe-inline'` nos scripts), porque nonce exige renderização dinâmica e derrubaria o LCP; as dinâmicas usam nonce + `'strict-dynamic'`. Alternativa: `experimental.sri` |
| S4 Conteúdo real dos arquivos e nome no download | parcial | `src/lib/arquivo-tipo.test.ts`: HTML disfarçado de PDF, PDF como .xlsx, Word como .xlsx, JPG como .png e binário como CSV são recusados; o tipo gravado é o detectado. Downloads com `filename*=UTF-8''…` (antes: "Conven%C3%A7%C3%A3o.pdf"). Commit "S4" | Rodar `e2e/bloqueadoras/s4-arquivos.mjs` no navegador: o servidor de teste foi parado pelo Claude Code por falta de memória antes da execução |
| S5 "Verificar prazos agora" só da conta | feito | `src/lib/avisos.test.ts`: antes, `rodarAvisos` não aceitava conta (rodava todas e devolvia as contagens de todos os clientes); depois, `rodarAvisos({ contaId })` verifica só a conta pedida e a mensagem diz "nesta conta". A rotina de hora em hora continua cobrindo todas. Commit "S5" | — |
