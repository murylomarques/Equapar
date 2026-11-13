# Equapar pronta para subir (v4): relatório

Branch `pronto-para-subir`, criada a partir de `main` (`9daef88`) sem alterações locais pendentes. Ordem das fases: A, B, C, F, G, D, E.
O dono aprovou de uma vez a migração aditiva (C6 e D4), as limpezas desligadas com simulação, as verificações de terceiros e a dependência `unpdf` (resposta "1" e depois "tem minha aprovação em tudo").

Como reproduzir as evidências: build de produção (`npm run build`) servido por `next start -p 3100`; testes de navegador com `BASE_URL=http://localhost:3100 SENHA_DONO=<senha do seed> NAVEGADOR=msedge`. As capturas ficam em `docs/pronto/capturas/` (PNG fora do git; gere com `node e2e/capturar.mjs docs/pronto/capturas <prefixo> <largura> <rotas>`, no Git Bash com `MSYS_NO_PATHCONV=1`).

## Onde parei

Fase A em andamento.

## Fase A: telas, demonstração e site

### A1. A Carteira não cabe na tela (feito)

Antes (`node e2e/medir-carteira.mjs`, o script A.2 do prompt, e o teste novo, contra o build anterior):

```
1280px: tabela 1372px, rolagem lateral na página: SIM; DIV.tabela-rolagem scroll=1372 visível=990 | ...
1440px: tabela 1372px, rolagem lateral na página: SIM; DIV.tabela-rolagem scroll=1372 visível=1150 | ...
$ node e2e/sem-rolagem-lateral.mjs
FALHA 390px /app/interno: largura 481 ≤ 390
FALHA 1280px /app/carteira: largura 1637 ≤ 1280
FALHA 1440px /app/carteira: largura 1637 ≤ 1440
3 verificação(ões) falharam.
```

Correção: tabela com largura fixa por coluna (`table-layout: fixed`), colunas contrato e órgão (com a convenção como linha secundária), próximo prazo, situação, valor mensal e ação ("Montar pedido" ou "Abrir"). Abaixo de 1.024 px, cartões.

Depois:

```
1280px: tabela 990px, rolagem lateral na página: não
1440px: tabela 1150px, rolagem lateral na página: não
$ node e2e/sem-rolagem-lateral.mjs     (Hoje, Carteira, Pedidos, os 5 passos, memória, A receber, Convenções, Configurações, painel interno; 390, 1.280 e 1.440 px)
Tudo certo.
```

Teste incluído em `npm run e2e`. Captura: `capturas/A1-carteira-1-1440.png`.

### A2. Painel interno invade o cartão vizinho (feito)

Antes: `FALHA 390px /app/interno: largura 481 ≤ 390` (acima). Correção: filhos das grades com `min-width: 0` e tabelas do painel rolando dentro do próprio cartão. Depois: incluído no mesmo teste, "Tudo certo". Captura: `capturas/A2-interno-1-390.png`.

### A3. A demonstração cria contas sem limite (feito)

Antes (`node e2e/demo-limite.mjs`, o script A.1 do prompt, só com `BASE_URL` configurável):

```
10 visitas em 11.4 s: contas demo 20 -> 30; contratos de demonstração 100 -> 150
saída: 1
```

Correção:
- cota por IP: no máximo 3 demonstrações por IP por hora (`usarCota` em `src/lib/limite.ts`, chave `demo:<ip>`, IP de `ipConfiavel`, com trava no banco para acessos em paralelo);
- limite global: `DEMO_MAX_ATIVAS` (padrão 300) demonstrações ativas; contagem e criação na mesma transação, com `pg_advisory_xact_lock`;
- os dois limites mostram "Você já abriu demonstrações demais agora. Tente de novo em uma hora ou fale com a gente", com o botão de contato, e registram o evento (`demo_limite_ip`, `demo_limite_global`);
- Turnstile no botão quando `TURNSTILE_SECRET_KEY` existe (mesmo padrão do Raio-X), também no botão de `/assessorias`;
- limpeza agendada: o worker chama `limparDemos` de hora em hora só com `LIMPEZA_DEMOS_AUTOMATICA=true` (padrão desligado). Entram só contas com `demo = true` e mais de 4 horas; as contas modelo nunca entram.

Depois (servidor com `TRUSTED_PROXY_HEADER=x-forwarded-for`, que o `next start` preenche com o IP de quem conectou):

```
10 visitas em 218.8 s: contas demo 30 -> 33; contratos de demonstração 150 -> 165
saída: 0
```

(As 7 visitas recusadas esperam os 30 s do script pela tela do app, por isso o tempo.) Teste no banco: `src/lib/limite-demo.db.test.ts` (6 pedidos em paralelo, só 3 passam; a simulação não inclui conta de cliente nem modelo).

Simulação da limpeza (trava 2, nada apagado):

```
$ npx tsx --tsconfig tsconfig.worker.json --env-file=.env scripts/limpar-demos.ts
SIMULAÇÃO: nada foi apagado.
{ "modo": "simulacao", "contas": 20, "contratos": 100, "pedidos": 42, "visitantes": 20,
  "contasDeClienteNaLista": 0, "modelosNaLista": 0, "contasDeClienteNoBanco": 6 }
```

Captura do aviso: `capturas/A3-limite-1-390.png`.

**Atenção para a produção:** sem `TRUSTED_PROXY_HEADER`, a cota por IP fica desligada (só vale o limite global). O `verificar:producao` (G2) avisa.
