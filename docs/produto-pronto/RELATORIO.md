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
| C2 Mudar a base não desfaz a aprovação | parcial | `e2e/bloqueadoras/c2-aprovacao-invalida.mjs`: antes, data-base e "contar até" mudavam com a memória ainda aprovada e o pedido em CALCULO_VALIDADO; depois, aprovação desfeita, EM_ANALISE e motivo no histórico. Commit "C2" | `hashCalculo` (C2.3) depende de migração: proposta aguardando o dono |
| C3 Validações do passo 3 podiam ser puladas | feito | `e2e/bloqueadoras/c3-pendencias.mjs`: antes, o pedido era gerado com linha alterada sem fonte e a diferença gravada (3.264,61) divergia da tela (4.955,71); depois, recusa com a pendência e link "Ir ao passo 3", e diferença gravada igual. `pendenciasParaGerar` com testes de unidade. Commit "C3" | — |
