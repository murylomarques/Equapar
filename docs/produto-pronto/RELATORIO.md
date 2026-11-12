# Produto pronto: relatório vivo (branch `produto-pronto`)

Atualizado a cada item. Situação: **feito**, **parcial**, **bloqueado** (esperando decisão do dono) ou **pendente**.

## Onde parei

Fase 0 em andamento.

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
| C6 Demonstração derruba visitantes e a sessão real | parcial | `e2e/bloqueadoras/c6-demo-sessoes.mjs`: antes, 4 falhas (visitante derrubado por outro com o mesmo navegador; a demo encerrava sessões de outros; cliente real perdia a sessão ao abrir /demonstracao); depois, todos continuam logados. `criarSessao` não apaga mais por navegador; `exigir` e `exigirUsuario` bloqueiam a demo num ponto só; `/demonstracao` virou página com botão (POST) e aviso para quem já está conectado. Commit "C6" | Demonstração isolada por visitante (C6.2) e limpeza das contas demo vencidas (C6.4) dependem de migração e de exclusão de dados: proposta aguardando o dono |
| C7 Conta tomada antes de existir | feito | `src/app/api/auth/google/callback/route.test.ts`: antes, o Google se ligava à conta criada com a senha de outra pessoa e a senha continuava valendo (3 falhas); depois, senha anulada se o e-mail não estava confirmado, outras sessões encerradas e aviso por e-mail. `e2e/bloqueadoras/c7-confirmar-email.mjs`: cadastro envia link assinado (24 h), aviso no topo com "Reenviar o link", sem confirmação não recebe avisos. Commit "C7" | — |
| C8 Duas etapas desligavam sem o código | parcial | `src/app/app/configuracoes/dois-fatores.test.ts`: antes, `iniciar2fa` sem código gravava `totpAtivo = false` (3 falhas); depois, exige código atual ou senha, o segredo novo fica pendente e só troca ao confirmar. 10 códigos de recuperação (só hashes no banco, uso único; `recuperacao.test.ts`). `e2e/assessoria-2fa.mjs`: troca sem código recusada; código de recuperação entra uma vez. Commit "C8" | Limite de tentativas do código no banco entra com o S1 |
