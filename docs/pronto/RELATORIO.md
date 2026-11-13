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
