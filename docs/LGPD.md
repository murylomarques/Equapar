# LGPD: dados pessoais tratados

> MINUTA, revise com seu jurídico. Os campos marcados com [PREENCHER] dependem do dono.

## Controlador e encarregado

- Controlador: [PREENCHER] razão social e CNPJ da Equapar.
- Encarregado (DPO): [PREENCHER] nome e e-mail de contato.

## Dados tratados

| Dado | De quem | Para quê | Base legal (art. 7º da LGPD) | Retenção |
| --- | --- | --- | --- | --- |
| Nome, e-mail de trabalho, senha (só hash) | Pessoas usuárias | Acesso e avisos | Execução de contrato (V) | Enquanto a conta existir; apagados ao excluir a conta |
| WhatsApp e a autorização de avisos | Quem marcou a autorização | Avisos de prazo | Consentimento (I), revogável com SAIR | Até revogar ou excluir a conta |
| Sessões (navegador resumido, data) | Pessoas usuárias | Segurança da conta | Legítimo interesse (IX) | Vencem em 12 h ou 30 dias |
| Tentativas de acesso (e-mail ou IP, contagem) | Quem tenta entrar | Segurança contra ataque | Legítimo interesse (IX) | Janela de 15 min a 1 dia |
| CNPJ, contratos públicos, convenções, planilhas de custos | Empresas clientes | O serviço contratado | Execução de contrato (V) | Enquanto a conta existir |
| E-mail e CNPJ do Raio-X (formulário público) | Visitantes | Mandar o relatório pedido | Consentimento (I) / procedimentos preliminares (V) | [PREENCHER] (sugestão: 12 meses) |
| Eventos de uso | — | Métricas do produto | Legítimo interesse (IX) | Sem dado pessoal |

Os dados do PNCP são públicos; registros de pessoa física vindos do PNCP são descartados na consulta.

## Quem processa dados para a Equapar (operadores)

| Operador | O quê | Quando |
| --- | --- | --- |
| Hospedagem e banco | Todos os dados | Sempre (provedor: [PREENCHER]) |
| Armazenamento S3 | Arquivos enviados | Com `ARMAZENAMENTO=s3` (provedor: [PREENCHER]) |
| Provedor de e-mail (SMTP) | E-mail e texto dos avisos | Com `SMTP_URL` |
| Meta (WhatsApp) | Telefone e texto dos avisos | Com as chaves do WhatsApp |
| Google | E-mail e nome no login | Com o login Google ligado |
| Anthropic (leitura de PDF com IA) | Conteúdo da planilha de custos enviada em PDF | Com `ANTHROPIC_API_KEY`; a IA só sugere linhas, a pessoa confirma |
| Cloudflare (Turnstile) | Sinais do navegador no formulário público | Com as chaves do Turnstile |

Cada um precisa de contrato com cláusulas de proteção de dados ([PREENCHER] pelo dono).

## Direitos do titular

- Exportar tudo: Configurações › Dados (ZIP em segundo plano, vence em 7 dias).
- Excluir a conta: Configurações › Dados (apaga banco e arquivos da conta).
- Parar avisos de WhatsApp: responder SAIR, PARAR ou STOP.
- Demais pedidos: [PREENCHER] e-mail do encarregado.
