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

### A6. Chave única MODO_PILOTO (feito)

`src/lib/chaves.ts`: `MODO_PILOTO` (padrão `true`). Ligada, esconde do menu, do "Mais", do site, do mapa do site (`/sitemap.xml`, novo) e das telas:
- `/assessorias`, o plano Assessoria em Preços e o bloco de assessorias da landing, e `/app/trocar-conta` (também no menu da conta; a ação `trocarConta` recusa);
- `/app/recuperado` (e o botão em A receber);
- o histórico do órgão (contrato e pedido);
- os guias de reforma tributária e da jornada (o da jornada volta com a chave da fase D). No ar sempre: `GUIAS_NO_AR` (repactuação passo a passo, prorrogação, convenção e data-base).

As rotas escondidas são tratadas no servidor, no `proxy` (valem na hora): 404 no site, redirecionamento para `/app/hoje` no app. Trava 10: nada é apagado.

**Decisão técnica:** as chaves e os dados `SITE_*` vêm do `.env` de quem sobe a imagem, mas as páginas do site eram geradas no build (com o ambiente do build). Agora elas se refazem a cada 60 s (`revalidate = 60`) com o ambiente de execução: depois de subir ou mudar uma chave, o conteúdo das páginas reflete o `.env` em até 1 minuto (o primeiro acesso depois disso ainda pode receber a versão anterior). Renderizar a cada requisição deixaria isso imediato, mas piorou o LCP do celular (mediana 2,90 s), então ficou a regeneração.

Prova:
- `src/lib/chaves.test.ts`: ligada, as 4 rotas escondem; desligada, as 4 voltam; os 3 guias do piloto sempre no ar; o da jornada só com a chave D.
- `e2e/modo-piloto.mjs`, rodado com o servidor subido com `MODO_PILOTO=false` e depois `true` (sem rebuild):

```
ESPERADO=desligado: /assessorias 200, guia de reforma 200, /app/recuperado e /app/trocar-conta abrem, link Recuperado visível
OK    mesmos dados nos dois estados: {"contas":39,"pedidos":72,"contratos":175,"documentos":0}
ESPERADO=ligado:
OK    /assessorias: 404 (esperado 404)
OK    /guias/reforma-tributaria-contratos-publicos-reequilibrio: 404 (esperado 404)
OK    /guias/... (os 3 do piloto) sempre no ar
OK    /app/recuperado → /app/hoje
OK    /app/trocar-conta → /app/hoje
OK    link Recuperado em A receber escondido
Tudo certo.
```

- A página 404 das rotas escondidas leva a CSP (achado pelo `s3-cabecalhos.mjs`, corrigido; "Tudo certo").
- Capturas: `capturas/A6-desligado-*.png` e `capturas/A6-ligado-*.png` (Preços e A receber nos dois estados).

### A7. Página do método das 1.447 empresas (feito)

`/metodo/levantamento-limpeza`, com o texto do Apêndice D: fonte e data, termos, o que conta e o que fica fora, agrupamento pela raiz do CNPJ, limites e como refazer. O número da landing leva a ela ("Veja o método"). Trava 8: nenhuma empresa é listada. `curl http://localhost:3100/metodo/levantamento-limpeza` → 200. (O bloco de assessorias da landing escondido pelo A6 entrou no mesmo commit do A7, porque os dois mexeram no mesmo arquivo.)

## Fase B: dados da empresa pelo ambiente

(O B3 foi feito antes do B1 porque o B1 valida `SITE_CNPJ` com a regra nova.)

### B3. CNPJ alfanumérico (feito)

Antes: `cnpjValido("12.ABC.345/01DE-35")` → `false` (só dígitos), e a máscara apagava as letras. Raio-X, cadastro e contratos recusariam o CNPJ novo.

Especificação usada: Receita Federal, "Perguntas e respostas: CNPJ alfanumérico", pergunta 14 (https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/cnpj/cnpj-alfanumerico.pdf). Cada caractere vale o código ASCII menos 48; módulo 11 com pesos 5 4 3 2 9 8 7 6 5 4 3 2 e 6 5 4 3 2 9 8 7 6 5 4 3 2. Exemplo oficial: 12.ABC.345/01DE, soma 459, resto 8, 1º dígito 3; soma 424, resto 6, 2º dígito 5: 12.ABC.345/01DE-35.

Correção: `normalizarCnpj` (maiúsculas, sem pontuação; é a forma guardada), `digitoCnpj`, `cnpjValido` e `mascaraCnpj` com letras nas 12 primeiras posições e dígitos numéricos no fim. Para CNPJ só com números, o cálculo é o mesmo de antes. Raio-X, cadastro, contratos, a busca no PNCP e os campos de CNPJ passaram a usar a forma canônica; o teclado do campo deixou de ser só numérico. Mensagens: "Confira os 14 caracteres".

Prova: `src/lib/cnpj-alfanumerico.test.ts` (o exemplo oficial, minúsculas e pontuação, dígito errado, letra no dígito, os CNPJs numéricos de antes). `npm test`: 56 arquivos, 227 testes passando.

APIs públicas com CNPJ alfanumérico (13/11/2026):
```
busca do PNCP (/api/search/?q=12ABC34501DE35&tipos_documento=contrato&status=vigente)  → HTTP 200, total 0 (aceita a consulta; ainda não há contrato publicado com CNPJ alfanumérico)
busca do PNCP com CNPJ numérico fictício (11222333000181)                             → HTTP 200, total 0
consulta pública /api/consulta/v1/contratos?cnpjOrgao=12ABC34501DE35                   → HTTP 204 (sem conteúdo, sem erro)
```
Nenhuma das duas recusa o formato novo. Quando houver contratos publicados com CNPJ alfanumérico, a comparação com `fornecedor_ni` já usa a forma canônica.

### B1. Variáveis SITE_* (feito)

Antes: `src/lib/site.ts` com `"[PREENCHER] ..."` no código (razão social, CNPJ, endereço, WhatsApp, fundador).
Depois: `dadosEmpresa()`, `contatoSite()` e `camposFaltando()` leem só `SITE_EMAIL_CONTATO`, `SITE_WHATSAPP`, `SITE_FUNDADOR_NOME`, `SITE_FUNDADOR_FOTO`, `SITE_RAZAO_SOCIAL`, `SITE_CNPJ`, `SITE_ENDERECO`, `SITE_CIDADE` e `SITE_AGENDA_URL`, com o comportamento da tabela do prompt para cada campo vazio (e-mail padrão `contato@equapar.com`; sem WhatsApp, contato por e-mail; sem fundador, o bloco "quem faz" fala só da empresa; sem foto, espaço neutro; sem razão social, "Equapar (empresa em constituição)"; sem CNPJ, nada; sem endereço, só a cidade). `SITE_CNPJ` passa pela validação da B3; inválido não aparece e o build avisa:

```
⚠ Site: variáveis vazias (o site esconde ou usa o padrão): SITE_EMAIL_CONTATO, SITE_WHATSAPP, ...
⚠ Site: SITE_CNPJ inválido; o CNPJ não aparece no site.
```

Prova: `src/lib/site.test.ts` (tudo vazio, só a cidade, CNPJ válido numérico e alfanumérico, CNPJ inválido), só com valores fictícios. Capturas com e sem `SITE_WHATSAPP` e `SITE_CNPJ`: na verificação final.

### B2. Domínio equapar.com (feito)

Antes: `equapar.com.br` fixo em `src/lib/mensagens.ts` (remetente), `src/lib/pncp.ts` (User-Agent), `.env.example` e testes.
Depois: `remetentePadrao()` (`EMAIL_FROM` ou `Equapar Avisos <avisos@<domínio do SITE_EMAIL_CONTATO>>`) e `agentePncp()` (APP_URL e `SITE_EMAIL_CONTATO`). `.env.example`: `EMAIL_FROM="Equapar Avisos <avisos@equapar.com>"`. Testes com domínios fictícios. Prova em `src/lib/site.test.ts` ("B2").

### B4. Botão de contato (feito)

`src/components/contato.tsx`: com `SITE_WHATSAPP`, "Falar no WhatsApp" (`https://wa.me/<dígitos>?text=Olá! Vim pelo site da Equapar e quero saber mais.`); sem ele, "Falar por e-mail" (`mailto:` do `SITE_EMAIL_CONTATO`); com `SITE_AGENDA_URL`, "Marcar uma conversa". Usado na demonstração e no aviso de limite, em Para assessorias, no plano Piloto e no fim de Preços, e no rodapé (que mostra o telefone formatado quando há WhatsApp). Prova: `src/lib/site.test.ts` ("B4"); captura `capturas/A3-limite-1-390.png` (sem WhatsApp: "Falar por e-mail").

### B5. Termos e privacidade sem CNPJ (feito)

`identificacaoEmpresa()`: sem `SITE_CNPJ`, "Equapar, empresa em constituição, sob a responsabilidade de <SITE_FUNDADOR_NOME>, <SITE_CIDADE>", com `SITE_EMAIL_CONTATO` como canal do titular; com CNPJ, razão social, CNPJ e endereço, sem nova programação. Os dois textos continuam marcados MINUTA. Prova: `src/lib/site.test.ts` ("B5").

### B6. Aviso de dados faltando (feito)

`src/lib/avisos-operacao.ts`: em produção, `/api/saude` devolve `avisos: [{ codigo: "dados_empresa_incompletos", detalhe: ["SITE_CNPJ", ...] }]` (só nomes) e o painel interno mostra o aviso no topo. O status continua 200: o CNPJ faltando não impede a subida. O mesmo mecanismo avisa `email_nao_configurado` (G6). Prova: `src/lib/avisos-operacao.test.ts`.
