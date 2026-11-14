# Equapar pronta para subir (v4): relatório

Branch `pronto-para-subir`, criada a partir de `main` (`9daef88`) sem alterações locais pendentes. Ordem das fases: A, B, C, F, G, D, E.
O dono aprovou de uma vez a migração aditiva (C6 e D4), as limpezas desligadas com simulação, as verificações de terceiros e a dependência `unpdf` (resposta "1" e depois "tem minha aprovação em tudo").

Como reproduzir as evidências: build de produção (`npm run build`) servido por `next start -p 3100`; testes de navegador com `BASE_URL=http://localhost:3100 SENHA_DONO=<senha do seed> NAVEGADOR=msedge`. As capturas ficam em `docs/pronto/capturas/` (PNG fora do git; gere com `node e2e/capturar.mjs docs/pronto/capturas <prefixo> <largura> <rotas>`, no Git Bash com `MSYS_NO_PATHCONV=1`).

## Onde parei

**Todas as fases (A, B, C, F, G, D, E) feitas e a verificação final (seção 9) rodada** em 13/11/2026, no build de produção e na imagem Docker. Duas metas não foram atingidas por completo e estão explicadas abaixo: o LCP do celular (mediana 2,67 s, meta 2,5 s) e a soma do retroativo por competência (C6, depende de um modelo de dados que o prompt mandou não criar agora).

**O que foi enviado e para onde: nada.** Todo o trabalho está só na branch local `pronto-para-subir`, criada a partir de `main` (`9daef88`). Nenhum push foi feito.

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

## Fase C: regras e textos das respostas jurídicas e contábeis

Tudo que é texto jurídico novo sai marcado MINUTA (trava 6). Regras novas só agem quando a pessoa preenche um campo novo (trava 3).

### C1. Frase sobre prorrogação (feito)
Antes, na landing: "Assinar a prorrogação sem pedir pode encerrar o direito à repactuação". Depois: "Vai prorrogar o contrato? Confira se há repactuação a solicitar e se cabe ressalva no termo aditivo.", com a fonte do TCU e o link "A regra depende do regime do contrato e da fase do pedido", que leva ao guia; o guia diz isso na seção "A regra".

### C2. Modelo de ressalva (feito)
No guia `prorrogacao-sem-perder-a-repactuacao` e na tela de decisão de prorrogação do app, o modelo antigo ("A CONTRATADA ressalva o direito...") virou o texto C2, marcado "MINUTA, revise com seu jurídico", com a nota de que o Parecer Referencial 00001/2025 da AGU exige pedido expresso para incluir a ressalva no contexto que analisou.

### C3. Descrição do serviço (feito)
Texto C3 no plano Piloto (Preços e tabela de planos) e nos Termos, com "Análise jurídica individual, estratégia de recurso e consultoria jurídica são atividades de advogado habilitado e não fazem parte do serviço". Busca por "assessoria jurídica" e "consultoria jurídica" como promessa no código: nenhuma ocorrência. A "proposta" do prompt é o modelo do C4.

### C4. Modelos do piloto e da autorização de caso (feito)
`docs/modelos/contrato-piloto.md` (com o texto C3 no topo) e `docs/modelos/autorizacao-caso.md`, marcados MINUTA. Nenhuma tela usa esses textos.

### C5. Alerta de prorrogação ampliado (feito)
`avaliarProrrogacao` em `src/lib/prorrogacao.ts`, mostrado antes de assinar (tela de decisão de prorrogação) e ao registrar a prorrogação, com o grau ao lado e "Ver por quê" com a fonte:

| Situação | Mensagem | Grau |
| --- | --- | --- |
| Convenção nova depositada, sem pedido protocolado e sem ressalva (o caso de antes, mesmo `riscoPreclusao`) | Revise antes de assinar: há repactuação a pedir. | Confirmado |
| Data-base passou, convenção nova não depositada, prorrogação a 60 dias ou menos | Registre a solicitação e avalie a ressalva antes de assinar. | Provável |
| Faltam dados (convenção ou data-base) | Faltam dados para avaliar o risco. Revise antes de assinar. | A conferir |

Prova: `src/lib/prorrogacao.test.ts`, os 5 testes antigos passando iguais e 5 novos.

### C6. Retroativo: valores já pagos e soma por competência (feito, com uma pendência)
Migração aditiva aplicada (`20261113200000_v4_retroativo_e_jornada`, o SQL mostrado ao dono e aprovado):
```sql
ALTER TABLE "Pedido" ADD COLUMN "jornadaDataAditivo" TIMESTAMP(3),
ADD COLUMN "jornadaInicioEfeitos" TIMESTAMP(3),
ADD COLUMN "retroCompararMes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ultimaCompetenciaPaga" TEXT,
ADD COLUMN "valoresJaPagos" DECIMAL(14,2) DEFAULT 0;
```
- Passo 3: "Valores já pagos pelo órgão no período" (padrão 0, descontado do retroativo; nunca deixa o total negativo), "Última competência paga pelo valor anterior" (informativo) e "Regra do caso em análise".
- Memória (tela e PDF): bruto, valor descontado, última competência e, com a regra do caso em análise, o resultado com dias corridos e com mês de 30 dias lado a lado; o pedido usa a opção escolhida.
- O valor pago entra na assinatura do cálculo só quando é maior que zero (as aprovações antigas continuam valendo) e, ao mudar, desfaz a aprovação.
- Prova: `src/lib/retroativo-pagos.test.ts` (com os campos vazios, o caso de exemplo continua R$ 33.951,94; R$ 1.951,94 pagos dão R$ 32.000,00; os dois resultados lado a lado; assinatura igual com campo vazio).
- **Pendência (soma por competência):** o modelo de dados guarda uma planilha atual e uma nova por pedido, sem a variação do número de postos ou do valor ao longo do período. Por isso o retroativo é a diferença mensal × meses, com o mês parcial pro rata. Não criei esse modelo (o prompt manda não criar agora). Para somar por competência quando postos ou valores mudam no período, é preciso guardar planilhas por competência.

### C7. Regra de arredondamento documentada (feito)
`docs/CALCULO.md` (seção "Arredondamento: por linha × só no total"), nota na memória de cálculo e o teste `src/lib/calculo/arredondamento.test.ts` com o caso C1: por linha 1.906,67 + 339,64 + 251,43 + 502,86 + 26,19 = **R$ 3.026,79**; só no total **R$ 3.026,78**. O motor não mudou; a decisão é do contador e do dono.

### C8. Proteção de dados (feito)
- **Papéis e subprocessadores:** a política de privacidade (MINUTA) explica a Equapar como operadora dos documentos enviados e controladora dos dados de cadastro, segurança e cobrança. Lista só os subprocessadores ligados (`src/lib/subprocessadores.ts`, lidos do ambiente: hospedagem por `HOSPEDAGEM_PROVEDOR`, armazenamento S3, e-mail pelo host do SMTP, Turnstile, Google, Asaas, WhatsApp e, só com uma chave de IA ligada, a Anthropic com a menção à transferência internacional do art. 33 da LGPD). Traz o canal do titular. Teste: `src/lib/subprocessadores.test.ts`.
- **Folha com nomes:** toda área de envio de arquivo (componente único `AreaArquivo`) mostra "Não envie folha com nomes ou CPFs de empregados. A planilha de custos basta.". A proteção técnica antes da IA está na fase E (E2).
- **Guarda depois do cancelamento:** "conta cancelada" = cobrança encerrada (somente leitura depois da carência). Por 30 dias a pessoa exporta tudo (a exportação continua liberada em somente leitura). Depois disso, a rotina `limparContasCanceladas` apaga só os documentos enviados; roda uma vez por dia no worker só com `LIMPEZA_CONTAS_CANCELADAS=true` (padrão desligado). Ficam fora: faturas e notas (cobrança), histórico de ações, sessões (registros de acesso), avisos enviados, a conta e os usuários.

Simulação (trava 2, nada apagado):
```
$ npx tsx --tsconfig tsconfig.worker.json --env-file=.env scripts/limpar-contas-canceladas.ts
SIMULAÇÃO: nada foi apagado.
{ "modo": "simulacao", "contas": 0, "documentos": 0,
  "mantidosPorLei": ["Fatura (cobrança e nota fiscal)", "Historico (registro de ações)", "Sessao (registros de acesso)", "Aviso (comunicações enviadas)", "Conta, Membro e Usuario"],
  "faturasMantidas": 0, "contasAtivasNaLista": 0 }
```
O banco de teste não tem conta cancelada. `src/lib/limpeza-canceladas.db.test.ts` cria três contas fictícias (cancelada há 40 dias, cancelada há 10 dias, ativa) e confere: só a de 40 dias entra; a fatura dela fica fora; a conta ativa nunca entra; a simulação não apaga nada.

**Ponto para o dono e o advogado:** "Excluir conta" (Configurações > Dados, pedido do próprio titular) apaga tudo na hora, inclusive as faturas, porque a fatura está ligada à conta com exclusão em cascata. Guardar a cobrança depois da exclusão exige mudar esse vínculo, e mudar `onDelete` é proibido nesta rodada (trava 1). Fica como decisão.

## Fase F: medição

### F1. Pesquisa de encaixe só para quem usou (feito)
Antes: `mostrarPesquisa` mostrava a pesquisa a qualquer conta com mais de 30 dias, mesmo sem nenhum pedido. Depois: só quando a conta não é demonstração, tem pelo menos 1 pedido com o dossiê gerado, o primeiro dossiê tem 7 dias ou mais e a pesquisa não foi respondida nem dispensada. A data vem da tabela de pedidos (`geradoEm` mais antigo). Prova: `src/lib/metricas.test.ts` ("F1"; o caso da conta antiga sem dossiê, que antes recebia a pesquisa, agora não recebe).

### F2. Ativação no painel interno (feito)
Conta ativada = pelo menos 1 contrato com prazo calculado e 1 pedido com o cálculo pronto (diferença mensal gravada); a data da ativação é a mais tardia das duas (para o pedido, `geradoEm` ou, sem ele, a última atualização: é uma aproximação, porque o sistema não guarda o momento exato em que o cálculo ficou pronto). O painel mostra as contas criadas no mês (sem demonstrações e sem as contas modelo), quantas ativaram e a porcentagem, a mediana em dias e a lista das criadas há mais de 3 dias e ainda não ativadas, com o e-mail do dono para o telefonema. Continua restrito a `PAINEL_EMAILS`. Prova: `src/lib/metricas.test.ts` ("F2").

## Fase G: pronto para subir

### G1. .env.example completo (feito)
Reescrito em três blocos (**para subir**, **para vender**, **depois**). Cada variável diz o que é, se é obrigatória, onde se obtém, o formato com exemplo fictício e o que acontece vazia. Inclui as novas: `SITE_*`, `MODO_PILOTO`, `DEMO_MAX_ATIVAS`, `LIMPEZA_DEMOS_AUTOMATICA`, `LIMPEZA_CONTAS_CANCELADAS`, `IA_LEITURA_PLANILHA`, `IA_LEITURA_CONVENCAO` e `HOSPEDAGEM_PROVEDOR` (subprocessador da C8). Conferido por comando: toda variável lida no código está no arquivo, e as únicas do arquivo sem leitura direta são `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`, que o SDK da AWS lê sozinho:
```
No código e fora do .env.example:        (nenhuma)
No .env.example e não usadas no código:  AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
```

### G3. docs/SUBIR.md (feito)
Passo a passo para quem nunca subiu um sistema, sem escolher provedor: banco PostgreSQL 17 com backup diário de 30 dias; bucket S3 privado com versionamento (e por que o R2 não serve sem uma cópia diária); domínio equapar.com, HTTPS e e-mail com SPF, DKIM e DMARC (regras do Google com a fonte); variáveis só no painel de segredos; os dois processos (app com migrações no CMD e worker com reinício automático); verificação, seed da demonstração, primeiro acesso, monitoramento, teste de restauração, teste final e o que fazer quando sair o CNPJ. Exemplo local: `docker-compose.producao.yml` (app, worker e banco separado do de desenvolvimento).

### G5. npm run e2e:producao (feito)
`e2e/producao.mjs`, só leitura, contra `APP_URL`: home 200 com CSP, HSTS e `X-Content-Type-Options`; `/api/saude` OK (e os avisos, se houver); Raio-X, preços, termos, privacidade, método e login abrem; a demonstração abre uma vez. Rodado contra o build de produção local:
```
OK    home responde 200 (veio 200)
OK    home com CSP
OK    home com HSTS
OK    home com X-Content-Type-Options: nosniff
OK    /api/saude OK (banco ok, fila ok)
OK    /raio-x abre (200) · /precos · /termos · /privacidade · /metodo/levantamento-limpeza · /entrar
OK    a demonstração abre (uma vez)
Tudo certo.
```
A rodada contra a imagem Docker (docker compose) está na verificação final.

### G6. E-mail pronto para ligar (feito)
Botão "Enviar e-mail de teste" no painel interno: manda para `PAINEL_EMAILS` e, se falhar, mostra o erro exato do provedor, sem a senha da `SMTP_URL` (`src/lib/email-teste.test.ts`: sem destinatário, sem SMTP e servidor fora do ar, com a senha nunca aparecendo). Em produção, sem `SMTP_URL` ou `EMAIL_FROM`, o `/api/saude` e o painel avisam (`email_nao_configurado`, B6). `docs/operacao/email.md`: SPF, DKIM, DMARC começando com `p=none`, DNS reverso, TLS e as regras do Google (SPF ou DKIM para qualquer remetente; SPF, DKIM e DMARC acima de 5.000 mensagens por dia; spam abaixo de 0,3%). Nenhum provedor escolhido e nenhuma chave no repositório.

## Fase D: jornada de 40 horas pronta e desligada

(Os commits D3 e D4 entraram junto com o D0, porque mexem nos mesmos arquivos do passo 1; o código e os testes de cada item estão indicados abaixo.)

### D0. Chave mestra (feito)
`JORNADA_REGRA_CONFIRMADA` (padrão false) é a chave mestra. A checagem é no **servidor**:
- `pedidoDaConta` (usado por todas as telas, ações e arquivos do pedido) trata o pedido da jornada como inexistente para quem não está em `PAINEL_EMAILS`;
- `acaoJornada` recusa escolher a jornada no passo 1 e montar pedidos da jornada em lote.

Desligada, cliente nenhum vê a jornada: nem o filtro e o lote da Carteira, nem a opção no passo 1, nem a faixa e o guia do site, nem o cartão de preço, nem o e-mail de aviso. Quem está em `PAINEL_EMAILS` vê tudo, com a marca "SIMULAÇÃO: regra em validação. Não protocolar." em toda tela do pedido (passos, memória, pedido pronto, Carteira), nos PDFs (ofício, memória, minuta do aditivo) e no Word (ofício). Ligada, a jornada vale para todos e a marca some; o cartão de preço (R$ 990 por contrato, `PRECO_JORNADA40_CONTRATO`) e a faixa (`SITE_FAIXA_JORNADA`) passam a depender também dela.
Prova: `src/lib/jornada-acesso.test.ts`; `src/app/app/pedidos/jornada-acoes.test.ts` ("D7": cliente comum recusado com a chave desligada e aceito com ela ligada); `src/lib/avisos-jornada.test.ts` (desligada, nenhum aviso).

### D1/D2. Representação: custo do posto sem inflar o salário (feito)
Antes: `planilhaDoCenario` multiplicava **toda** linha em R$ (inclusive materiais do módulo 5) e a linha "Salário base" mostrava R$ 1.906,67, acima do piso. Depois:
- o salário e os demais valores por empregado ficam no valor da convenção; o aumento entra como **empregados equivalentes por posto** (anterior ÷ nova, 44/42 = 1,047619, fator exato no cálculo e com 6 casas na tela);
- cada linha tem o atributo "acompanha o número de empregados" (sim nos módulos 1 a 4 e benefícios; não em materiais e equipamentos do módulo 5; uniformes sim, editável no passo 3);
- a memória mostra, por exemplo, "R$ 1.820,00 × 1,047619 empregados equivalentes = R$ 1.906,67 por posto (EC 141/2026, jornada 44 para 42 h)";
- no cenário reduzir, os valores por empregado não mudam (art. 2º da EC 141) e o documento registra a redução das horas entregues (4,545% de 44 para 42).

### D3. Etapa travada pela data (feito)
O passo 1 tem a escolha da **etapa** (44 → 42 a partir de `JORNADA_42H_INICIO`; 42 → 40 a partir de `JORNADA_40H_INICIO`) e recusa efeitos financeiros fora da etapa. 44 → 40 num só aditivo não existe no formulário nem na ação. Prova: `src/lib/jornada-d.test.ts` (etapa pela data) e `jornada-acoes.test.ts` ("D3").

### D4. Três datas (feito)
Início da etapa (a data geral), data do aditivo (quando formalizado) e início dos efeitos financeiros (padrão: o início da etapa). O retroativo usa os efeitos financeiros (`calcularPedido`), e a assinatura do cálculo inclui essa data. Migração aditiva na C6 (`jornadaDataAditivo`, `jornadaInicioEfeitos`). Prova: `jornada-acoes.test.ts` ("D4").

### D5. Os dois cenários no documento (feito)
O ofício (Word e PDF) mostra "manter horas" e "reduzir horas" lado a lado, com a preferência da empresa marcada e a frase "A escolha do cenário e a formalização cabem ao órgão, pelo rito do contrato". Ofício e minuta continuam MINUTA. Prova: `src/lib/documentos-jornada.db.test.ts` (os dois cenários, a preferência, a frase e a marca de simulação no Word).

### D6. Alerta de prorrogação na jornada (feito)
Etapa começada, mão de obra dedicada e prorrogação sem pedido da jornada: "Revise antes de assinar: a jornada mudou e não há pedido de reequilíbrio.", grau Provável, no mesmo componente da C5 (tela de decisão e registro da prorrogação), só para quem pode ver a jornada. Prova: `src/lib/prorrogacao.test.ts` ("D6").

### D7. Testes (feito, com 1 pendente)
`src/lib/jornada-d.test.ts`: caso C1 por linha em 44 → 42, cenário manter (1.820,00 → 1.906,67; 324,20 → 339,64; 240,00 → 251,43; 480,00 → 502,86; 25,00 → 26,19); cenário reduzir sem mudança; trava da etapa. Permissão no servidor: `jornada-acesso.test.ts` e `jornada-acoes.test.ts`. Testes do motor iguais (trava 3). **Pendente (`it.todo`):** o preço completo do posto do caso C1, que aguarda a planilha completa assinada pelo contador.

## Fase E: leitura por IA pronta e desligada

### E1. Chaves (feito)
`IA_LEITURA_PLANILHA` e `IA_LEITURA_CONVENCAO` (padrão false), em `src/lib/ia-acesso.ts`. Sem `ANTHROPIC_API_KEY`, nada aparece (como antes). Com a chave da API e a chave do recurso desligada, só os e-mails de `PAINEL_EMAILS` veem a leitura (PDF da planilha no passo 2, convenção no passo 3), com o selo "em teste". Com true, vale para todos. As ações conferem no servidor. Prova: `src/app/app/pedidos/convencao-ia.test.ts` ("E1": cliente recusado com a chave desligada, `PAINEL_EMAILS` aceito, ninguém sem a chave da API).

### E2. Proteção antes de enviar à IA (feito)
Antes de mandar um PDF à IA, `textoDoPdf` (dependência nova `unpdf` 1.9.1, só leitura, sem binário nativo; aprovada pelo dono) extrai o texto, e `contarCpfs` procura CPFs (11 dígitos com dígito verificador válido, com ou sem máscara). Achou: o arquivo não é enviado nem guardado, e a tela mostra "Este arquivo parece ter CPF de pessoas. Tire nomes e CPFs ou digite os valores à mão.". Prova: `src/lib/cpf.test.ts` e `src/lib/pdf-texto.test.ts` (PDF de verdade gerado no teste, com CPF fictício gerado pelo algoritmo, trava 7) e `convencao-ia.test.ts` ("E2": nada gravado). O `package-lock.json` só ganhou a `unpdf` (conferido: nenhuma versão de outro pacote mudou).

### E3. Avaliação da leitura de convenção (feito; a rodada com as convenções reais fica para o dono)
- `fixtures/gabarito-convencoes.json`: o Apêndice C, com `"conferido": false` nas 3 convenções. Os PDFs reais ficam em `convencoes-reais/`, fora do git (trava 9).
- `scripts/avaliar-ia-convencao.ts`: roda `lerConvencaoPdf` (as mesmas instruções do sistema; `INSTRUCOES_CONVENCAO` não mudou) com o posto de exemplo e compara valor, cláusula e página. Mostra acertos, erros, omissões, os campos deixados para conferência humana (confiança baixa), o acerto por nível de confiança, a lista de erros com o trecho, e o tempo e os tokens de cada leitura (custo com `--preco-entrada` e `--preco-saida`, porque o preço é do contrato do dono com a Anthropic).
- **Unidade e condição** não são avaliadas: a leitura atual não devolve esses campos, e devolvê-los exige mudar `INSTRUCOES_CONVENCAO` (precisa do "ok" do dono). O relatório diz isso em cada convenção.
- Regra para ligar: gabarito conferido por uma pessoa **e** nenhum erro com confiança alta (`podeLigar`).

Rodada com a convenção **fictícia** criada por mim (`scripts/gerar-convencao-ficticia.ts` gera o PDF; `fixtures/convencao-ficticia/`). Sem chave da API nesta máquina, a rodada usa respostas gravadas (`--simular`), para conferir o caminho da avaliação:
```
Modo: SIMULAÇÃO (respostas gravadas ...; nenhuma chamada à API)
== FIC000001/2026 (ficticia) · gabarito conferido
   acertos 7 · erros 2 · omissões 1 · deixados para conferência humana (confiança baixa) 2
   por confiança: alta 5 acertos / 0 erros · baixa 0 acertos / 2 erros
   ERRO insalubridade [baixa]: valor 40 ≠ 20 · trecho: "adicional de 20% ou 40% conforme o grau"
   ERRO vale_transporte [baixa]: sugeriu 6, mas a convenção não traz valor em reais (desconto até 6% do salário-base)
   OMISSAO beneficio_social [-]: não sugeriu; esperado 20 (R$/mês por empregado)
RESULTADO: o gabarito está conferido e nenhum erro tem confiança alta. A IA pode ser ligada.
```
Com o gabarito real:
```
Sem ANTHROPIC_API_KEY: nada foi enviado. ...
AVISO: Gabarito não conferido por pessoa: o resultado não autoriza ligar a IA. (SP002852/2026, PR000063/2026, MG004404/2025)
RESULTADO: NÃO ligar a IA (gabarito não conferido por pessoa).
```
Prova: `src/lib/avaliacao-ia.test.ts`.

## Verificação final (seção 9)

Build de produção servido por `next start` na porta 3100, e a imagem Docker com `docker-compose.producao.yml`. Dados de teste fictícios.

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | sem erro |
| `npm run lint` | sem erro e sem aviso |
| `npm test` | 66 arquivos, 270 testes passando, 1 pendente (`it.todo`, D7) |
| `npm run test:db` | 72 arquivos, 282 testes passando (com os de banco). O script estava quebrado (o vitest novo não acha os testes com `--dir src`); corrigido |
| `npm run build` | compila; avisa as variáveis `SITE_*` vazias |
| `npm run e2e` | fluxo completo 23/23 no computador e 23/23 no celular; assessoria com duas etapas 9/9; `sem-rolagem-lateral` 39/39 |
| `npm run e2e:a11y` | 105 verificações, 0 violações graves |
| `npm run e2e:teclado` | 14 páginas, todas com anel de foco |
| Outros de navegador | jornada 12/12; fase 2 (no modo piloto) 10/10; C1 a C4, C6, C7, L7, S3 (25/25), S4, S11, S12: todos "Tudo certo"; `modo-piloto.mjs` nos dois estados |
| A.1 (demonstração) | `10 visitas em 221.4 s: contas demo 40 -> 43; contratos de demonstração 200 -> 215`, saída 0 (no máximo 3 por IP) |
| Lighthouse celular (mediana de 3) | **LCP 2,67 s** (meta 2,5 s **não** atingida), FCP 0,93 s, TBT 515 ms, **CLS 0**. Ver A5 |
| Chaves ligadas e desligadas | capturas `capturas/V-desligado-*` (tudo desligado), `capturas/V-ligado-*` (jornada, IA e dados do site ligados), `capturas/V-ia-em-teste-*` (chave da API sem as chaves do recurso: selo "em teste"), `capturas/A6-ligado-*` e `capturas/A6-desligado-*` (modo piloto) |
| Site com e sem `SITE_WHATSAPP` e `SITE_CNPJ` (fictícios) | sem: "Falar por e-mail", "Equapar (empresa em constituição)", rodapé sem CNPJ; com: "Falar no WhatsApp" (`wa.me/5511900000000`), "Empresa Exemplo Ltda., CNPJ 12.ABC.345/01DE-35", fundador, rodapé com telefone. Capturas de landing, preços, termos e privacidade nos dois estados (`V-desligado-1..4`, `V-ligado-1..4`) |
| CNPJ alfanumérico | exemplo oficial da Receita em `src/lib/cnpj-alfanumerico.test.ts` |
| `verificar:producao` | as duas saídas abaixo |
| Imagem Docker | construída; app e worker sobem com `docker compose -f docker-compose.producao.yml up -d`; `/api/saude` 200; o worker processou a tarefa de avisos (`AVISOS | FEITA`); `npm run e2e:producao` contra `http://localhost`: "Tudo certo" (com os avisos `dados_empresa_incompletos` e `email_nao_configurado` no `/api/saude`, como esperado sem esses dados) |
| G4 (seed da demonstração) | na imagem, duas rodadas seguidas: `2 contas | 10 contratos | 4 pedidos | 2 usuários` depois de cada uma (não duplica) |
| Simulações das limpezas | A3 e C8, nas seções dos itens |
| Avaliação E3 | rodada com a convenção fictícia (seção E3) |
| Folha única | `capturas/folha-unica.png`: landing, Raio-X, preços, demonstração, Hoje, Carteira, Pedidos, passo 3, memória, A receber, Convenções e painel interno, em 390 e 1.440 px |

`npm run verificar:producao:imagem` dentro da imagem, com um ambiente fictício **completo** (S3 local com S3Mock, SMTP local com Mailpit; a imagem do MinIO não está disponível sem login):
```
OK    Base           APP_URL começa com https:// · APP_SECRET com 32 caracteres ou mais
OK    Banco          conectou · todas as 9 migrações aplicadas
OK    Armazenamento  S3: gravou, leu e apagou o objeto de teste em _verificacao/
OK    E-mail         SMTP: conectou e autenticou · e-mail de teste enviado para 1 endereço(s) de PAINEL_EMAILS
OK    Turnstile      as duas chaves preenchidas
OK    Asaas          ambiente sandbox coerente com o prefixo da chave · token do webhook presente
OK    Rede           TRUSTED_PROXY_HEADER = x-forwarded-for
OK    Site           vai aparecer: e-mail contato@equapar.com; WhatsApp; nome do fundador; razão social e CNPJ; endereço
OK    Chaves         MODO_PILOTO ligada · JORNADA_REGRA_CONFIRMADA desligada · IA desligadas · limpezas desligadas · DEMO_MAX_ATIVAS 300
0 falha(s), 0 aviso(s).   saída: 0
```
E com um ambiente **incompleto**:
```
FALHA Base           APP_URL não começa com https:// (obrigatório em produção)
FALHA Base           APP_SECRET com MENOS de 32 caracteres
AVISO Armazenamento  sem ARMAZENAMENTO=s3: arquivos no disco do servidor (perdidos se o contêiner for recriado)
AVISO E-mail         sem SMTP_URL: ninguém confirma conta nem recebe aviso
FALHA Turnstile      TURNSTILE_SECRET_KEY e NEXT_PUBLIC_TURNSTILE_SITE_KEY precisam estar juntas (só uma está preenchida)
FALHA Asaas          ASAAS_AMBIENTE não combina com o prefixo da ASAAS_API_KEY
FALHA Asaas          ASAAS_WEBHOOK_TOKEN FALTANDO com o Asaas ligado
AVISO Rede           sem TRUSTED_PROXY_HEADER: os limites por IP ficam desligados
AVISO Site           vazias: SITE_EMAIL_CONTATO, SITE_WHATSAPP, ...
5 falha(s), 4 aviso(s).   saída: 1
```

### Achados da verificação final (corrigidos)
- `npm run test:db` não achava os testes (`--dir src`); corrigido.
- O aviso de CPF da C8 entrou no rótulo da área de arquivo: dois testes buscavam o rótulo "Nome" por trecho e passaram a achar dois campos. Os testes agora buscam o rótulo exato; o aviso ganhou linha própria (estava colado em "até 15 MB").
- `fase2.mjs` testava telas que o modo piloto esconde; passou a seguir a chave. O C6 abre várias demonstrações do mesmo IP e agora bate na cota do A3; o teste zera a cota local de demonstração antes.
- No compose, o worker herdava o healthcheck do app (porta 3000); desligado só no worker.

### Pendências que não dependem só do dono
1. **LCP no celular** (A5): mediana 2,67 s na máquina de teste (`benchmarkIndex` 687). O que sobra é o React e o roteador do Next executados antes da primeira pintura. Medir de novo contra a produção, com rede real: `node scripts/lighthouse.mjs https://equapar.com/ 3`.
2. **Retroativo por competência** (C6): exige guardar planilhas por competência (novo modelo de dados), que o prompt mandou não criar agora.
3. **Preço completo do posto no caso C1** (D7): `it.todo` até chegar a planilha completa assinada pelo contador.

## O que só o dono faz

1. Preencher o `.env` (no painel de segredos da hospedagem): as obrigatórias (`DATABASE_URL`, `APP_SECRET`, `APP_URL` em https, `TRUSTED_PROXY_HEADER`, `ARMAZENAMENTO=s3` e o bucket) mais `SITE_WHATSAPP`, `SITE_EMAIL_CONTATO`, `SITE_FUNDADOR_NOME` e `SITE_CIDADE`.
2. Confirmar o registro do domínio equapar.com, apontar o DNS e ativar o HTTPS.
3. Contratar hospedagem, banco (PostgreSQL 17 com backup de 30 dias), bucket S3 com versionamento e provedor de e-mail, e configurar SPF, DKIM e DMARC (`docs/SUBIR.md` e `docs/operacao/email.md`).
4. Criar as chaves do Turnstile e, se quiser, as do login com Google.
5. Rodar `npm run verificar:producao:imagem` e `npm run e2e:producao` e decidir sobre as limpezas (`LIMPEZA_DEMOS_AUTOMATICA`, `LIMPEZA_CONTAS_CANCELADAS`) depois de ler as simulações (A3 e C8).
6. Quando o primeiro cliente fechar: abrir o CNPJ, preencher `SITE_RAZAO_SOCIAL`, `SITE_CNPJ` e `SITE_ENDERECO`, abrir a conta PJ no Asaas (testar no sandbox) e definir a nota fiscal com o contador.
7. Trazer o "de acordo" do advogado (Parte 3) e do contador (Parte 4, com a planilha C1 completa e a regra de arredondamento, C7). Depois disso, ligar `JORNADA_REGRA_CONFIRMADA`.
8. Fazer uma pessoa conferir nos PDFs os valores do gabarito das 3 convenções (`fixtures/gabarito-convencoes.json`), mudar `conferido` para `true`, pôr os PDFs em `convencoes-reais/`, rodar `scripts/avaliar-ia-convencao.ts` com a chave da Anthropic e só então ligar `IA_LEITURA_CONVENCAO` (e `IA_LEITURA_PLANILHA`). Decidir se a leitura deve devolver unidade e condição (muda `INSTRUCOES_CONVENCAO`).
9. Levar ao advogado as minutas: termos, privacidade, contrato do piloto, autorização de caso (`docs/modelos/`), modelo de ressalva (C2), frase de prorrogação (C1), ofício e minuta do aditivo da jornada. Decidir também sobre "Excluir conta" apagar as faturas (C8).
10. Decidir quando enviar a branch `pronto-para-subir` ao GitHub (nada foi enviado).
