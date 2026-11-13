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

### A4. Textos que prometem o que não existe (feito)

Antes (build anterior, `curl` das páginas):
- landing: "Ver a tela por dentro (2 min)"; prévia com "R$ 48,3 mil" e o deferido no contrato 12/2024, enquanto a demonstração mostra R$ 31,5 mil no 07/2025;
- preços: "Avisos por e-mail e WhatsApp" e "WhatsApp" no plano Carteira sem a integração; "Exemplo: 375 postos dão R$ 1.500 por mês. Revisão de especialista é cobrada à parte." (a revisão está desligada).

Correção:
- "Ver a demonstração";
- WhatsApp só com `WHATSAPP_TOKEN` (`canaisDeAviso()`); sem ele, "Avisos por e-mail";
- prévia e demonstração saem do mesmo conjunto fictício (`src/lib/exemplo-demo.ts`, usado pela prévia e pelo seed): R$ 31,5 mil, contratos 45/2025, 12/2024 e 07/2025, 18 e 21 dias;
- linha de apoio: "Software e apoio operacional para a repactuação de contratos elegíveis: a Equapar organiza documentos e prazos, consolida os dados e gera a memória de cálculo e os arquivos editáveis que demonstram a variação de custos. Você confere e protocola." (base: texto C3);
- Carteira: "74 postos = R$ 297 (mínimo); 75 postos = R$ 300"; Piloto com o botão de contato; revisão de especialista só aparece se ligada; desconto anual segue 0%. Assessoria e jornada: ver A6 e D0.

Prova: `src/lib/a4-textos.test.ts` (74 → R$ 297, 75 → R$ 300; WhatsApp só com token; prévia e demonstração com o mesmo valor). Capturas: `capturas/A4-antes-1-1440.png`, `capturas/A4-antes-2-1440.png` e as do depois na verificação final.

### A5. Velocidade no celular (parcial: meta não atingida de forma estável nesta máquina)

Medição: `node scripts/lighthouse.mjs http://localhost:3100/ 3` (Lighthouse 12.8.2, celular simulado, 3 rodadas, mediana; Edge como navegador). CSP intacta.

| Etapa | Mediana LCP | FCP | TBT | CLS |
| --- | --- | --- | --- | --- |
| Antes (build da v2) | 2,78 s | 0,91 s | 529 ms | 0 |
| Formulário do CNPJ no servidor, "Revelar" sem JavaScript, "Entrar" como link comum | 2,75 s | 0,93 s | 412 ms | 0 |
| Toasts e confirmações só no app, no login e no Raio-X (fora da landing) | 2,69 s | 1,23 s* | 197 ms | 0 |
| CSS em arquivo em vez de embutido (o HTML caiu de 179 KB para 66 KB: o CSS ia duas vezes, no `<style>` e de novo no RSC) | 2,63 s | 0,95 s | 377 ms | 0 |
| Menu do celular com `<details>` nativo (a landing não tem mais nenhum componente de cliente nosso) | **2,60 s** | 0,92 s | 266 ms | 0 |

\* nesta rodada as fontes não eram pré-carregadas; voltou o pré-carregamento, e a fonte do texto passou a `display: "optional"`.

O que foi feito: o formulário do CNPJ da landing e dos guias é renderizado no servidor e funciona sem JavaScript (a página do Raio-X valida e mantém a máscara); a animação de entrada ao rolar saiu; "Entrar" virou link comum (quem já tem sessão é levado ao app pela própria `/entrar`); o provedor de toasts saiu da landing; o CSS deixou de ser embutido; o menu do celular não usa JavaScript.

**Resultado honesto:** as rodadas boas ficam entre 2,54 e 2,60 s, mas a mediana de 3 rodadas não fica de forma estável abaixo de 2,5 s neste computador. O LCP observado (sem simulação) é 0,5 a 0,8 s. O que sobra no caminho é o próprio React e o roteador do Next (cerca de 390 KB sem compressão, executados antes da primeira pintura porque o servidor local entrega tudo em menos de 100 ms). A máquina de medição é lenta para o fator 4x do Lighthouse (`benchmarkIndex` 687), o que infla a parte de CPU da simulação. Recomendação: repetir `node scripts/lighthouse.mjs https://equapar.com/ 3` contra a produção, com rede real. Não mudei o fator de CPU para melhorar o número.
