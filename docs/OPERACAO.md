# Operação

## Implantar

1. Banco PostgreSQL 17 gerenciado, com backup automático (ver abaixo).
2. Bucket privado compatível com S3 (AWS S3, Cloudflare R2…), sem acesso público.
3. Variáveis de ambiente: todas do [`.env.example`](../.env.example). Em produção, no mínimo: `DATABASE_URL`, `APP_SECRET`, `APP_URL` (HTTPS), `ARMAZENAMENTO=s3` e as do bucket, `TRUSTED_PROXY_HEADER`.
4. Imagem: `docker build -t equapar .` e `docker run --env-file .env -p 3000:3000 equapar`. Ao subir, a imagem aplica as migrações (`prisma migrate deploy`) e inicia o app.
5. Dados da demonstração: uma vez, `npm run db:seed:demo` (não cria usuário Dono).
6. Saúde: `GET /api/saude` (200 = ok; 503 = banco fora). Use no balanceador e num monitor de disponibilidade externo (ex.: a cada minuto, alerta após 2 falhas).

Migrações são sempre **aditivas** (tabela, coluna anulável ou com padrão, valor de enum, índice). Assim a versão nova roda com o banco migrado e a anterior também.

## Voltar versão

1. Suba a imagem anterior (a tag do commit anterior). Como as migrações só acrescentam, o banco migrado serve à versão anterior.
2. Não desfaça migração com DROP. Se uma coluna nova atrapalhar, ela fica sem uso até a correção.

## Backup e restauração

- **Diário**: snapshot do PostgreSQL gerenciado (retenção mínima de 30 dias) e versionamento do bucket (retenção de 30 dias).
- **Manual**: `pg_dump --format=custom "$DATABASE_URL" > equapar-AAAA-MM-DD.dump`.
- **Restaurar** (num banco novo, nunca por cima do de produção):
  ```bash
  createdb equapar_restaurado
  pg_restore --no-owner --dbname "postgresql://.../equapar_restaurado" equapar-AAAA-MM-DD.dump
  ```
  Aponte uma instância de teste para ele, abra `/api/saude` e confira algumas contas.
- **Teste de restauração**: uma vez por mês, restaure o backup da véspera num banco de teste e registre data, tamanho e tempo. Backup que nunca foi restaurado não conta.

## Rotacionar segredos

| Segredo | Como | Efeito |
| --- | --- | --- |
| `APP_SECRET` | Trocar derruba os links assinados em aberto (confirmação, senha, convite, relatório do Raio-X) e o segredo cifrado das duas etapas. **Antes**, peça às pessoas com duas etapas que desativem, ou planeje recifrar | Links antigos deixam de valer |
| Senha do banco | Crie a nova no provedor, troque `DATABASE_URL`, reinicie, remova a antiga | — |
| Chaves de S3, SMTP, WhatsApp, Google, Anthropic, Turnstile | Gere a nova no provedor, troque a variável, reinicie, revogue a antiga | — |
| `WHATSAPP_APP_SECRET` | Trocar junto na Meta e no app | Webhooks com a assinatura antiga são recusados |

## PNCP fora do ar

- O Raio-X mostra "O PNCP não respondeu agora" e oferece avisar por e-mail (uma nova tentativa com mais tempo; na fase 1, a fila tenta de novo a cada 30 minutos por 24 horas).
- A importação de contratos mostra o erro e sugere cadastrar à mão. Nada é perdido.
- Resultados recentes ficam em cache (`RaioXCache`).

## Fila parada (fase 1)

- Sinais: `/api/saude` com a fila atrasada; avisos de hora em hora não aparecem em Avisos.
- Conferir o processo `npm run worker` (logs JSON com `evento`), reiniciar. Tarefas presas são retomadas quando a trava vence.

## Ligar cada integração

Toda integração nasce em **simulação**. Ligar é decisão do dono (chave real).

| Integração | Variáveis | Antes de ligar |
| --- | --- | --- |
| E-mail | `SMTP_URL`, `EMAIL_FROM` | SPF, DKIM e DMARC no domínio |
| WhatsApp | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | Modelos aprovados na Meta, incluindo `equapar_deferido_valor`; webhook apontando para `/api/whatsapp/webhook` |
| Login com Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | URI de retorno `APP_URL/api/auth/google/callback` |
| Leitura de PDF com IA | `ANTHROPIC_API_KEY` | Atualizar a página de privacidade e o `docs/LGPD.md` (operador) |
| Captcha | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Domínio cadastrado no Turnstile |
| Alerta de erro | `ERROS_WEBHOOK_URL` | Endpoint que recebe JSON |
| Arquivos em S3 | `ARMAZENAMENTO=s3`, `S3_*`, `AWS_*` | Bucket privado, cifrado, versionado |
| Cobrança (Asaas) | `ASAAS_API_KEY`, `ASAAS_AMBIENTE=producao`, `ASAAS_WEBHOOK_TOKEN`; depois `COBRANCA_EXIGIR_PLANO=true` | Testar no sandbox (chave `$aact_hmlg_…`); cadastrar o webhook em `APP_URL/api/cobranca/asaas` com o mesmo token; escolher o emissor da nota fiscal |

## Rotinas de limpeza (sempre simulam antes)

`scripts/limpar-demos.ts`, `limpar-orfaos.ts`, `limpar-exportacoes.ts` e `normalizar-whatsapp.ts` contam o que fariam. Só apagam ou alteram com `--aplicar`, e isso depende do "ok" do dono. Hoje leem o disco; com S3, use o ciclo de vida do bucket ou a fila da fase 1.
