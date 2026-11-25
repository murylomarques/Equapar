# Checklist de homologação

Cada item só é marcado com **evidência** anotada ao lado (data, quem fez, print, ID do evento, saída do comando). Itens só com evidência local continuam desmarcados até a repetição no ambiente de homologação. Infraestrutura geral continua em [../SUBIR.md](../SUBIR.md) e [../OPERACAO.md](../OPERACAO.md); aqui fica só o que a homologação exige.

Regras durante a homologação: nenhuma chave de produção do Asaas; `IA_ORCAMENTO_*` continuam em 0; nenhum dado pessoal real fora do ambiente de homologação.

## 1. Asaas sandbox

Pré-requisito: conta no sandbox do Asaas (https://sandbox.asaas.com) e o ambiente de homologação no ar com HTTPS.

- [ ] Variáveis no ambiente de homologação: `ASAAS_AMBIENTE=sandbox` (qualquer valor diferente de `producao` usa `https://api-sandbox.asaas.com/v3`), `ASAAS_API_KEY=<chave do sandbox>`, `ASAAS_WEBHOOK_TOKEN=<32+ caracteres aleatórios>`, `COBRANCA_SIMULACAO` **ausente** (com chave configurada a simulação fica desligada). Evidência: ___
- [ ] Webhook no painel do sandbox: URL `https://<homologação>/api/cobranca/asaas`, token de autenticação = `ASAAS_WEBHOOK_TOKEN`, eventos de cobrança: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_DELETED`, `PAYMENT_RESTORED`, `PAYMENT_CHARGEBACK_REQUESTED`. Evidência: ___
- [ ] Token errado é recusado: enviar POST sem o cabeçalho `asaas-access-token` → resposta 401. Evidência: local + túnel, 25/11/2026, pelo túnel: sem token 401, token errado 401, token certo 200. Repetir na homologação.
- [ ] **Não** criar assinatura (`/subscriptions`) no painel: a renovação é gerada pela Equapar; assinatura no painel cobraria em dobro.

Cenários (anotar o ID da fatura e do evento).

Primeira rodada em 25/11/2026, **local + túnel** (servidor local, webhook real do sandbox por túnel cloudflared), com a conta fictícia `dono@exemplo.local` restaurada no fim. Precisa ser repetida no ambiente de homologação com a URL definitiva. Achados e corrigidos nessa rodada:
- chave em arquivo `.env` começando com `$` era lida vazia pelo Next (o sistema ficava em simulação sem avisar): escape `\$aact_…` documentado em `.env.example`;
- conta que abriu cobrança em simulação guardava cliente `sim_cus_…`, e com o Asaas ligado a cobrança dava erro 400: agora o cliente é criado de verdade (teste em `cobranca.test.ts`);
- renovação gerada depois do início do período (rotina parada) ia com vencimento no passado, o Asaas recusava e a transação inteira voltava, deixando a conta com o plano pago sem cobrança: agora vai com vencimento hoje e a régua conta do início do período (teste em `cobranca.test.ts`; conferido no sandbox, pay_0_e3gfjha6nttw0b).


| # | Cenário | Como | Esperado | Evidência |
|---|---|---|---|---|
| A1 | Contratar Carteira mensal | Configurações → Cobrança → Carteira → Ver o que muda → Abrir a cobrança | cobrança criada no sandbox; plano só muda depois do pagamento | OK (local + túnel, 25/11/2026): fatura cmwwblc7400016fpck2r55d6l → pay_0_piqlt7um27ulxx, PENDING R$ 297, cliente cus_000010117859; plano Grátis até pagar. Repetido depois das correções: pay_0_hv51zueshrdzo6 |
| A2 | Pagamento confirmado | pagar a cobrança no sandbox | `PAYMENT_CONFIRMED`/`RECEIVED`; plano Carteira; "Período pago até" = início + 1 mês | OK (local + túnel, 25/11/2026): pago no sandbox (receiveInCash); webhook real `PAYMENT_RECEIVED` evt_d26e303b238e509335ac9ba210e51b0f&25998942 → PAGA; Carteira até 25/12/2026 16:10:40 |
| A3 | Webhook repetido | reenviar o mesmo evento pelo painel | nada muda (idempotente); um único `EventoCobranca` | OK (local + túnel, 25/11/2026): o mesmo evento reenviado ao webhook (por script, mesmo id) → `repetido`; EventoCobranca não cresceu. Reenvio pelo painel do Asaas não testado |
| A4 | Eventos fora de ordem | `PAYMENT_OVERDUE` chegando depois de `PAYMENT_RECEIVED` | continua paga | OK (local + túnel, 25/11/2026): `PAYMENT_OVERDUE` enviado depois do pagamento → `ignorado`; fatura PAGA, conta EM_DIA |
| A5 | Vencimento sem pagamento | deixar vencer | `ATRASADA` → carência em 10 dias → somente leitura em 25; nenhum dado apagado | PARCIAL (local + túnel, 25/11/2026): renovação real pay_0_6tkjggkbfax8ks; o `PAYMENT_OVERDUE` foi enviado por script (o sandbox só avisa no dia seguinte ao vencimento) e os dias foram simulados recuando datas no banco local: ATRASADA → CARENCIA até +25 dias → somente leitura; contratos 5 → 5. Falta ver o aviso real do Asaas |
| A6 | Renovação | rotina horária perto do fim do período | nova cobrança criada uma vez só; sem duplicar na rodada seguinte | OK (local + túnel, 25/11/2026): fim do período a 5 dias (datas recuadas no banco local); duas chamadas a `/api/cron/avisos` → renovacoes 1 e 0; fatura cmwwbmt8x00016fn0em7t5l2e → pay_0_waa5wqixzy2af1, vence no início do período novo (30/11) |
| A7 | Cancelar a renovação | Cancelar a renovação | acesso até o fim do período pago; cobrança não iniciada cancelada no sandbox | OK (local + túnel, 25/11/2026): "Confirmar o cancelamento" na tela; Carteira até 30/11; renovação CANCELADA; pay_0_waa5wqixzy2af1 deleted=true no sandbox; webhook `PAYMENT_DELETED` → ignorado |
| A8 | Estorno integral | estornar no painel | período estornado sai; fatura marcada | OK (local + túnel, 25/11/2026): pago com cartão de teste (pay_0_nx7uxf95xqcih0, CONFIRMED); estorno pela API do sandbox → webhook `PAYMENT_REFUNDED` → ESTORNADA R$ 297; plano Grátis |
| A9 | Estorno parcial | estornar parte | acesso mantido; fatura marcada para revisão | PARCIAL (local + túnel, 25/11/2026): pay_0_9t7tpny1ztjsz7 pago com cartão; o Asaas recusa estorno parcial no mesmo dia ("só pode ser estornada parcialmente no próximo dia"). Evento `PAYMENT_PARTIALLY_REFUNDED` enviado por script (R$ 100) → fatura PAGA, R$ 100 estornado, revisão ESTORNO_PARCIAL, Carteira mantido. Falta o estorno parcial real (a partir do dia seguinte ao pagamento) |
| A10 | Pagamento após cancelamento | pagar uma cobrança já cancelada | não reativa o plano; fatura marcada para devolução manual | OK (local + túnel, 25/11/2026): pay_0_waa5wqixzy2af1 (cancelada no A7) restaurada e paga no sandbox → `PAYMENT_RESTORED` ignorado, `PAYMENT_RECEIVED` → revisão PAGA_APOS_CANCELAMENTO; renovação segue cancelada, acesso igual |
| A11 | Pagamento duplicado | pagar duas cobranças do mesmo período | só um período; a outra marcada para devolução manual | OK (local + túnel, 25/11/2026): segunda cobrança pay_0_7bynvyhygx5k50 com a mesma referência paga no sandbox → revisão PAGAMENTO_DUPLICADO; nenhuma fatura nova, período igual |
| A12 | Upgrade com período pago | Carteira paga → Assessoria | recusado na tela com contato para análise manual; nenhuma cobrança criada | OK (local + túnel, 25/11/2026): tela "Upgrade com período pago em andamento… fale com a gente"; faturas 1 → 1; cobranças do cliente no Asaas iguais antes e depois |

- [ ] Todas as faturas marcadas (`revisao` preenchida) têm um responsável e um procedimento de devolução manual definido. Evidência: ___

## 2. Conferência da migração financeira (`20261124120000_protecao_financeira`)

A migração só acrescenta colunas e tabelas; o backfill dá período apenas a pagamentos **ainda válidos**. Antes de aplicar em produção:

- [ ] Backup do banco de produção feito e **restauração testada** numa cópia. Evidência: ___
- [ ] Aplicar a migração **na cópia** (`npx prisma migrate deploy` apontando para a cópia), nunca direto na produção nesta etapa. Evidência: ___
- [ ] Na cópia, rodar as consultas abaixo (somente leitura) e conferir cada linha com o dono:

```sql
-- 1. Faturas pagas que ficaram sem plano (descrição fora do padrão "Plano carteira/assessoria (...)")
SELECT id, "contaId", descricao, valor, "pagaEm" FROM "Fatura" WHERE status = 'PAGA' AND plano IS NULL;

-- 2. Contas pagantes sem período pago depois da migração (vão aparecer como plano mantido manualmente)
SELECT id, nome, plano, "planoVigenteAte" FROM "Conta" WHERE plano <> 'GRATIS' AND ("planoVigenteAte" IS NULL OR "planoVigenteAte" < NOW());

-- 3. Períodos calculados: conferir com o que foi vendido a cada cliente
SELECT f."contaId", c.plano, f.ciclo, f."periodoInicio", f."periodoFim", f.valor FROM "Fatura" f JOIN "Conta" c ON c.id = f."contaId"
WHERE f.status = 'PAGA' AND f."periodoFim" IS NOT NULL ORDER BY f."contaId", f."periodoInicio";

-- 4. Cobranças em aberto no Asaas que viram renovação/compra
SELECT id, "contaId", descricao, valor, vencimento, status FROM "Fatura" WHERE status IN ('ABERTA', 'FALHOU');
```

- [ ] Cada conta da consulta 2 tem decisão anotada (período informado à mão, Grátis, ou cortesia). Ninguém rebaixado sem decisão. Evidência: ___
- [ ] Só depois: janela combinada, backup novo e `migrate deploy` em produção. Evidência: ___

## 3. Rotina de hora em hora

`GET /api/cron/avisos` com `Authorization: Bearer <CRON_SECRET>` faz, numa chamada: avisos de prazo, renovação e régua de cobrança (`renovarAssinaturas`) e expiração de reservas de IA.

- [ ] `CRON_SECRET` com 32+ caracteres no ambiente. Evidência: ___
- [ ] Agendador externo de hora em hora (cron do provedor ou `curl` agendado). Evidência: ___
- [ ] Sem o cabeçalho → 401. Evidência: ___
- [ ] A resposta JSON traz `assinaturas` e `reservasIaExpiradas`; anotar uma resposta real. Evidência: ___
- [ ] Alerta quando a rotina falhar ou não rodar por mais de 2 horas (monitor de cron/heartbeat). Evidência: ___
- [ ] Duas chamadas seguidas não criam cobrança duplicada (cenário A6). Evidência: ___

## 4. Infraestrutura e monitoramento

Detalhes em [../SUBIR.md](../SUBIR.md).

- [ ] Banco PostgreSQL gerenciado com backup diário e restauração testada. Evidência: ___
- [ ] `APP_SECRET` (32+), `APP_URL` com https, `TRUSTED_PROXY_HEADER` do provedor. Evidência: ___
- [ ] Armazenamento: `ARMAZENAMENTO=s3`, bucket privado com versionamento. Evidência: ___
- [ ] E-mail: `SMTP_URL`, `EMAIL_FROM`; SPF, DKIM e DMARC válidos (teste com um provedor de verificação). Evidência: ___
- [ ] Turnstile: `TURNSTILE_SECRET_KEY` e `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (sem eles o captcha fica simulado). Evidência: ___
- [ ] Domínio e HTTPS; cabeçalhos de segurança conferidos (`e2e/bloqueadoras/s3-cabecalhos.mjs` contra a URL de homologação). Evidência: ___
- [ ] Monitor de disponibilidade em `/api/saude`. Evidência: ___
- [ ] Erros do servidor: `ERROS_WEBHOOK_URL` apontando para um canal acompanhado. Evidência: ___
- [ ] `PAINEL_EMAILS` só com os e-mails da equipe. Evidência: ___
- [ ] IA: `IA_ORCAMENTO_*` = 0 e `ANTHROPIC_API_KEY` ausente na homologação, salvo decisão escrita do dono com o orçamento (proposta em [IA.md](IA.md)). Evidência: ___
- [ ] `MODO_PILOTO` com o valor decidido pelo dono. Evidência: ___
- [ ] Core Web Vitals de usuários reais (dados de campo) acompanhados nas primeiras semanas. Evidência: ___

## 5. Dados jurídicos reais da empresa

Não preencher com nada que não esteja no cartão CNPJ ou no contrato social.

- [ ] `SITE_RAZAO_SOCIAL`, `SITE_CNPJ`, `SITE_ENDERECO`, `SITE_CIDADE`, `SITE_EMAIL_CONTATO` (e `SITE_WHATSAPP`, se houver). Fonte: cartão CNPJ. Evidência: ___
- [ ] Rodapé sem "empresa em constituição" depois das variáveis (conferir na tela). Evidência: ___
- [ ] Mesmos dados na conta do Asaas (nome que aparece na cobrança). Evidência: ___
- [ ] Dados da empresa nos termos, na política de privacidade e nas minutas (controlador, encarregado/DPO, contato). Evidência: ___

## 6. Termos e política de privacidade

- [ ] Advogado revisou termos de uso, política de privacidade, contrato do piloto (`docs/modelos/`) e os textos do plano Piloto. Evidência: parecer/e-mail com data.
- [ ] Textos do plano Piloto na página de preços (3 itens, mesmo sentido do texto C3) aprovados. Evidência: ___
- [ ] Política de cancelamento, devolução manual e upgrade por análise manual ([COBRANCA.md](COBRANCA.md)) refletida nos termos. Evidência: ___
- [ ] Suboperadores listados na política conferidos com o que está ligado (hospedagem, e-mail, S3, Asaas, Turnstile; Anthropic só se a IA for ligada). Evidência: ___
- [ ] Data de vigência real colocada nos textos aprovados e faixa "Minuta" retirada. Evidência: ___

## Saída da homologação

Publicar só com as seções 1, 2, 5 e 6 completas e com evidências, e as seções 3 e 4 no ar. Até lá: **não publicar**.
