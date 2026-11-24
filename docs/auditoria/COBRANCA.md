# Cobrança e assinatura: política e auditoria (P0)

Branch `auditoria-total`. Código: `src/lib/assinatura.ts` (regras puras), `src/lib/cobranca-servidor.ts` (transações), `src/lib/cobranca.ts` (gateway), `src/app/api/cobranca/asaas/route.ts` (webhook), `src/app/app/configuracoes` (tela e ações). Migração aditiva `20261124120000_protecao_financeira`.

## Defeitos encontrados (antes)

| # | Defeito | Evidência | Consequência |
|---|---|---|---|
| C1 | Escolher **Grátis** mudava o plano na hora, mesmo com período pago | `configuracoes/acoes.ts` (ramo `GRATIS`) | Cliente perdia o que já tinha pago (anual inclusive) |
| C2 | Cobranças em aberto **não eram canceladas** no cancelamento | idem | Cliente pagava depois e não recebia nada; vencimentos deixavam a conta Grátis em atraso, carência e **somente leitura** |
| C3 | **Plano pago nunca vencia** | não havia período nem renovação | Um pagamento = plano para sempre (perda de receita) |
| C4 | Estorno não mexia no acesso | `aplicarEvento` (ESTORNADO) | Estorno integral mantinha o plano pago |
| C5 | Idempotência do webhook fora da transação | `processarEventoPagamento` | Duas entregas simultâneas: uma falhava com 500 (o Asaas reenviava) |
| C6 | Eventos fora de ordem sem regra | idem | Ex.: vencimento depois do pagamento contava tentativa |
| C7 | Botões "Simular pagamento" em produção sem Asaas | `configuracoes/page.tsx` | Qualquer cliente "pagaria" o próprio plano |
| C8 | Compra nunca paga levava a conta à carência e somente leitura | régua aplicada a qualquer fatura | Cliente punido por uma cobrança de algo que nunca recebeu |

Confirmado no código: a Equapar usa só **cobranças avulsas** (`/payments`) no Asaas. **Não há assinatura recorrente** (`/subscriptions`): a renovação é gerada pela própria Equapar.

## Política em vigor (depois)

- **Acesso pago = períodos efetivamente pagos.** Cada fatura diz o que compra (plano, ciclo, período). O plano da conta é recalculado a partir das faturas pagas (`direitoDeAcesso`, `planoEfetivo`). Escolher um plano nunca libera nada antes do pagamento.
- **Compra/upgrade:** abre a cobrança; o período começa no pagamento. O período anterior **não vira crédito automático** (decisão comercial pendente; a tela avisa antes de confirmar).
- **Downgrade entre planos pagos** e **troca de ciclo:** valem na renovação.
- **Cancelamento (Grátis):**
  - com período pago em andamento: cancela a **renovação**; o acesso pago segue até o fim do período; a data e as consequências aparecem antes de confirmar; pode ser desfeito até a data ("Manter a assinatura");
  - sem período pago: Grátis na hora.
  - Dados, documentos, histórico e exportação ficam preservados em todos os casos.
- **O que é cancelado:** só fatura em aberto cujo período **ainda não começou** (compra não paga ou renovação futura). Fatura cujo período já começou corresponde a serviço prestado: continua devida.
- **Renovação:** gerada 7 dias antes do fim do período (rotina de hora em hora no worker e no cron), uma por período (trava por conta), com o valor recalculado pelos postos ativos naquele dia. Paga com atraso, mantém a continuidade (o período começa no fim do anterior).
- **Atraso:** a régua existente (3 tentativas, carência de 15 dias, depois somente leitura) vale só para fatura **devida**. Conta Grátis sem fatura devida nunca fica em atraso.
- **Pagamento depois do cancelamento:** registrado como pago, **não compra período** e fica marcado para devolução (`revisao = PAGA_APOS_CANCELAMENTO`).
- **Estorno integral:** o período daquela fatura deixa de contar; os outros períodos pagos continuam (ex.: estornar um upgrade não tira o anual já pago).
- **Estorno parcial:** acesso mantido, valor registrado, marcado para revisão humana.
- **Contestação (chargeback):** acesso mantido até a decisão, marcado para revisão.

## Webhook

1. Token `asaas-access-token` conferido em tempo constante antes de ler o corpo.
2. Evento sem `id` é recusado (400).
3. Numa transação: `INSERT … ON CONFLICT DO NOTHING` do id do evento (a mesma entrega, mesmo simultânea, vale uma vez); `SELECT … FOR UPDATE` da fatura; transição monotônica (fora de ordem não desfaz); recálculo do plano; resultado gravado no evento (rastreio e reconciliação; "fatura-nao-encontrada" fica registrado).
4. Eventos tratados: `PAYMENT_CONFIRMED`/`RECEIVED`, `OVERDUE`, `REFUNDED`, `PARTIALLY_REFUNDED`, `DELETED`, `RESTORED`, `CHARGEBACK_REQUESTED`. Os demais respondem 200 sem efeito.

## Testes

- `src/lib/assinatura.test.ts`: 21 casos das regras puras (período, transições, fora de ordem, estornos, acesso, previsão).
- `src/lib/assinatura.db.test.ts` (banco): compra; **5 entregas simultâneas do mesmo evento aplicadas uma vez**; vencimento depois do pagamento; troca de plano antes de pagar; cancelamento com período pago (acesso até a data, renovação cancelada, pagamento posterior não reativa, Grátis depois da data, dados e faturas preservados); desfazer o cancelamento; Grátis sem período (cobrança antiga vencida não deixa a conta somente leitura); downgrade Assessoria → Carteira na renovação; **renovação rodando duas vezes ao mesmo tempo gera uma fatura**; renovação devida não paga entra na régua e não é cancelada; pagamento atrasado mantém continuidade; estorno parcial e integral; estorno de upgrade preserva o anual.
- `src/lib/cobranca.test.ts`: eventos novos, `DELETE /payments/{id}` no Asaas, simulação proibida em produção.

## Riscos residuais e decisões pendentes (do dono)

- **Crédito proporcional em upgrade:** hoje não há (regra explícita). Decidir se converte o período restante em desconto.
- **Devolução** de pagamento após cancelamento e de estorno parcial: feita à mão no Asaas; a tela mostra a marcação.
- **Dados de cartão salvo / cobrança automática:** a renovação gera cobrança avulsa (Pix, boleto ou cartão na hora). Migrar para `/subscriptions` do Asaas só se o dono quiser débito automático.
- Testado em simulação e com cliente HTTP falso. **Falta testar com o sandbox do Asaas** (chave de sandbox e webhook apontando para um ambiente público).

## Revisão independente do código (segunda rodada) e correções

Um revisor sem contexto das minhas conclusões auditou o código de cobrança e de IA e encontrou falhas reais, todas corrigidas e cobertas por testes de banco:

| Achado | Sev. | Correção |
|---|---|---|
| Renovação devida e nunca paga mantinha o plano pago para sempre (a régua só andava a cada aviso de vencimento, e o Asaas avisa uma vez) | P0 | A régua anda pelo calendário a partir do início do período devido (atrasada → carência em 10 dias → somente leitura em 25), na rotina de hora em hora |
| Renovação cuja criação no gateway falhou nunca era refeita | P0 | A rotina recria a cobrança de renovação sem `gatewayId` |
| Dois cliques criavam duas cobranças no Asaas (a trava cobria só o banco) | P0 | A chamada ao gateway acontece dentro da trava da conta; a fatura igual devolve a mesma cobrança |
| Pagamento de cobrança duplicada passava em silêncio | P0 | Marcado `PAGAMENTO_DUPLICADO` para devolução |
| Upgrade pago depois de uma renovação já paga era desfeito na virada | P1 | Em períodos sobrepostos vale o plano maior; a renovação paga sobreposta é marcada `RENOVACAO_PAGA_SOBREPOSTA` |
| Abrir (sem pagar) um upgrade desfazia o cancelamento | P1 | Cancelamento e mudança agendada só caem quando a compra é paga |
| Backfill podia rebaixar clientes antigos para Grátis | P1 | Só períodos ainda válidos recebem data; pagamento antigo deixa o plano como manual |
| Eventos de faturas diferentes da mesma conta podiam gravar plano desatualizado | P2 | O recálculo trava a linha da conta |
| Cancelamento/mudança concorrendo com a rotina de renovação | P2 | Todas as decisões de cobrança usam a mesma trava por conta |
| Mudança agendada nunca limpa quando já coberta | P2 | Limpa quando a data passou e há período pago |
| "Restaurada" no gateway reabria cobrança que o cliente cancelou | P2 | Ignorada quando o cancelamento foi da Equapar |
| Vencimento de compra nunca iniciada mandava e-mail de atraso | P2 | Régua só para fatura devida |
| Rotina atrasada deixava a conta cair para Grátis sem renovação | P2 | A renovação é gerada antes do recálculo, mesmo atrasada |

## Compatibilidade com o Asaas

A Equapar cria apenas cobranças avulsas (`POST /payments`, com `externalReference` = id da fatura) e remove as que deixam de ser devidas (`DELETE /payments/{id}`). Não usa `/subscriptions`. Se alguém criar uma assinatura manualmente no painel do Asaas para um cliente da Equapar, os pagamentos dela chegam ao webhook sem fatura correspondente: ficam registrados como "fatura-nao-encontrada" e **não liberam nada**, mas o cliente seria cobrado duas vezes (pela assinatura e pela renovação da Equapar). Regra operacional: **não criar assinaturas no painel do Asaas** para clientes da Equapar. Devoluções (pagamento após cancelamento, duplicado, renovação sobreposta, estorno parcial) continuam manuais, com a marcação na fatura; nenhum crédito proporcional é gerado automaticamente.
