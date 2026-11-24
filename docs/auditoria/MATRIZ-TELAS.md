# Matriz das telas auditadas

Fonte dos achados: inspeção própria e quatro revisões visuais independentes (cada uma com um quarto das telas), feitas sobre as capturas reais em 5 resoluções (`D:\Equapar\capturas-auditoria`). Situação: **Corrigido** (com recaptura), **Por design** (decisão registrada), **Pendente** (com severidade). P1 = atrapalha entender, confiar ou converter, ou parece quebrado; P2 = acabamento perceptível; P3 = menor.

## Site público

| Tela | Achado | Sev. | Situação |
|---|---|---|---|
| 01 Landing | Quadro vazio no lugar da foto do fundador | P2 | Corrigido |
| 01 Landing | FAQ e chamada final com margem esquerda diferente das outras seções | P2 | Corrigido |
| 01 Landing | Comparação "Três jeitos" no celular escondia a coluna da Equapar | P1 | Corrigido (cartões, Equapar primeiro) |
| 01 Landing | Tabelas dos mockups dos passos 1 e 4 cortadas no celular | P2 | Pendente |
| 01 Landing | Mockup do passo 2 repete o da abertura; aviso "exemplo ilustrativo" repetido 5 vezes; formulário de CNPJ 3 vezes | P2 | Pendente (decisão de conteúdo) |
| 02 Raio-X entrada | Pares órgão/data sem agrupamento visual no exemplo | P3 | Pendente |
| 03 Raio-X resultado | Coluna "Valor global" toda com "—" | P2 | Pendente |
| 04 CNPJ inválido | Mensagem de erro longe do campo; campo sem borda de erro | P2 | Pendente |
| 05 Preços | Sem margem lateral no tablet e no celular (`.secao` zerava a margem) | P1 | Corrigido (afetava 7 páginas) |
| 05 Preços | Grade com coluna vazia; calculadora isolada; preços fixos no código da calculadora | P2 | Corrigido |
| 05 Preços | Ações dos cartões em alturas e larguras diferentes; "R$ / 1.500" quebrando | P2 | Corrigido |
| 05 Preços | Bloco final repetia o conteúdo dos cartões | P2 | Corrigido ("Bom saber antes de escolher") |
| 06 Assessorias, 13b Guia 40 h | 404 | — | Por design (escondidas no modo piloto) |
| 07 Guias, 08 Guia | Sem indicação de clique / sem trilha de volta | P3 | Pendente |
| 09 Privacidade, 10 Termos | Faixa "MINUTA" pública | P1 | Por design até o advogado aprovar (pendência de produção) |
| 11 Entrar | — | — | Ok |
| 12 Criar conta | Nomes das etapas quebrando no meio da palavra no celular | P1 | Corrigido |
| 12 Criar conta | Campo CNPJ mais estreito que os outros | P3 | Pendente |
| 13 Não encontrada | Sem cabeçalho e rodapé do site; texto de app | P2 | Pendente |
| Rodapé | "empresa em constituição" | P2 | Por design até `SITE_RAZAO_SOCIAL`/`SITE_CNPJ` (pendência de produção) |

## App: início, carteira e contratos

| Tela | Achado | Sev. | Situação |
|---|---|---|---|
| 14 Hoje | Pesquisa antes do trabalho do dia (celular) e mais larga que a coluna | P2 | Corrigido |
| 14 Hoje | Total a receber diferente da tela A receber | P1 | Corrigido |
| 14 Hoje | "resposta preferencial até —" | P2 | Corrigido |
| 14 Hoje | Rótulo antigo "Gerar cobrança" | P2 | Corrigido |
| 14 Hoje | Indicadores quebrando no celular; triângulos em "Próximos 90 dias" | P3 | Pendente |
| 16/17 Primeiros passos | Etapas cortadas e quebradas no celular | P1 | Corrigido |
| 17 Convenções (início) | Cabeçalhos de grupo diferentes; campos abertos de opção não escolhida | P2 | Pendente |
| 15, 18 | Espaço vazio; aviso sem link | P3 | Pendente |
| 19/20 Carteira | Texto colado ("30/11/2026Próximo") no celular | P2 | Corrigido |
| 19/20 Carteira | 7 filtros ocupando a tela no celular | P2 | Corrigido (faixa rolável) |
| 19/20 Carteira | "Próximo prazo" em 5 linhas; cabeçalho de valor desalinhado | P2 | Corrigido |
| 19 Carteira | Filtros de situação misturados com esfera | P2 | Pendente |
| 52 Carteira jornada | Faixa com uma palavra por linha e botão sobre o título (celular) | P1 | Corrigido (todo alerta com ação) |
| 21 Cadastrar contrato | Grade e larguras inconsistentes; UF cortado no celular | P2 | Pendente |
| 22–26 Contrato | Contadores das abas em vermelho (regressão minha) e "(0)" | P2 | Corrigido |
| 22–26 Contrato | Abas cortadas no celular | P2 | Corrigido (rolam até a ativa, com sombra na borda) |
| 23 Prazos | Duas ações principais | P2 | Corrigido |
| 27 Prorrogação | Duas ações principais | P2 | Corrigido; selo "Confirmado" vermelho: Pendente P3 |
| 24 Pedidos do contrato | Linhas sem ação visível; "—" sem explicação | P2 | Pendente |
| 26 Histórico | "Nada registrado" com pedido existente | P2 | Dado de exemplo (seed sem histórico); conferir import real: Pendente |
| 41 Busca | Destaque afastava a palavra dos parênteses | P3 | Corrigido |
| 42 Menu da conta | — | — | Ok |

## App: pedido e financeiro

| Tela | Achado | Sev. | Situação |
|---|---|---|---|
| 32 Passo 3 | 7 campos empilhados por linha, só com placeholder | P1 | Corrigido (sub-linha com rótulos, recolhida quando completa, "usar esta fonte nas outras linhas") |
| 32 Passo 3 | Anualidade vem marcada "Conferida" por padrão | P1 | Pendente (decisão: tornar obrigatória a escolha muda a regra de validação) |
| 31/32 Passos 2 e 3 | Página longa (50 linhas abertas); coluna Base apertada | P2 | Pendente |
| 32 Passo 3 | Painel da memória corta texto | P2 | Pendente |
| 33 Passo 4 | Áreas de envio estreitas; aviso de CPF repetido | P2 | Pendente |
| 34 Passo 5 | "Gerar pedido" principal sem a memória aprovada | P1 | Corrigido (aprovar vira a ação principal) |
| 35 Memória | Botão PDF cortado no celular (regressão minha) | P1 | Corrigido |
| 35 Memória | Tabela retroativa quebrando valores em 3 a 5 linhas no celular | P1 | Corrigido (conta embaixo do mês; competência "jan/2026") |
| 35 Memória | "Comentar" repetido; sem total combinado | P2 | Pendente |
| 36/37 Pedido | Datas da linha do tempo fora de ordem | P1 | Corrigido |
| 37 Deferido | "R$ 0,00" em pedido anterior às novas colunas | P1 | Corrigido ("não registrado" / "a conciliar") |
| 36/37 | Arquivos "RASCUNHO" em pedido antigo já protocolado | — | Por design (arquivo final exige versão aprovada; a tela oferece aprovar) |
| 36 Protocolado | Dois alertas empilhados | P2 | Pendente |
| 37 Deferido | Sete números com o mesmo peso | P2 | Pendente |
| 28 Lista de pedidos | Cartões do celular sem valores | P2 | Pendente |
| 38 A receber | — | — | Ok |
| 50 Recuperado | Escondido | — | Por design (modo piloto) |
| 51 Pedido de exemplo | Sem chamada ao fim | P2 | Pendente |

## Avisos, configurações, assessoria, demonstração

| Tela | Achado | Sev. | Situação |
|---|---|---|---|
| 40 Avisos (antes) | Um cartão por mensagem, texto cru, sem ação | P1 | Corrigido (central por evento) |
| 40c Histórico | Ocorrências iguais repetidas | P1 | Corrigido (agrupadas por tipo, com contagem) |
| 40c Histórico | "não está mais na sua conta" soava como perda de dados | P2 | Corrigido |
| 40c Histórico | Resolvido e Informativo com o mesmo selo | P2 | Corrigido |
| Avisos/Config | Menu lateral sem item ativo nessas páginas | P2 | Pendente |
| 46 Cobrança | Postos e valor sumiram (regressão minha); fatura pendente sem link | P1 | Corrigido |
| 46b Previsão | Compra igual já aberta podia ser aberta de novo | P0 | Corrigido (servidor reaproveita a mesma cobrança; tela avisa) |
| 46 Cobrança | Sem selo "Atual" no plano; período "2026-11" cru | P3 | Pendente |
| 44 Pessoas | "Remover" com aparência de ação segura | P2 | Corrigido |
| 44/45 | Alinhamentos e títulos de seção | P3 | Pendente |
| 47 Segurança | 25 sessões iguais | P2 | Corrigido (5 recentes + total) |
| 39 Convenções | Rótulo do depósito em 2 linhas desalinhando a grade | P2 | Corrigido |
| 50 Clientes (assessoria) | Tabela cortada no celular; CNPJ quebrado | P1 | Corrigido (cartões) |
| 49 Clientes vazio | Estado vazio sem ação; larguras diferentes | P2 | Pendente |
| 51 Demonstração | Indicadores desalinhados no celular | P2 | Pendente |
| 43, 48 | — | — | Ok |

## Resumo

- P1 encontrados: 18 (mais 1 P0 de cobrança duplicada na tela 46b). Corrigidos: 16 e o P0. Por design até decisão externa: 1 (faixa MINUTA em privacidade e termos). Pendente: 1 (anualidade pré-marcada no passo 3, depende de decisão de regra).
- Regressões introduzidas por mim nesta auditoria e corrigidas: 4 (contador das abas do contrato, botão PDF da memória, linhas da cobrança, e a quebra no `node_modules` ao remover a cópia de comparação, que exigiu `npm ci`).
- P2/P3 pendentes estão listados acima; nenhum bloqueia uso ou confiança no fluxo principal.
