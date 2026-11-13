# Subir a Equapar (passo a passo)

Para quem nunca subiu um sistema. Não escolhemos provedor: os nomes abaixo são **exemplos**. Siga na ordem e marque cada passo.

O sistema roda como **dois processos** a partir da mesma imagem Docker: o **app** (site e sistema) e o **worker** (avisos, consultas ao PNCP, exportações e limpezas). Os dois leem as mesmas variáveis de ambiente.

---

## 1. Banco de dados

1. Contrate um **PostgreSQL 17 gerenciado** (exemplos: AWS RDS, Google Cloud SQL, Neon, Supabase, DigitalOcean).
2. Ligue o **backup diário automático, guardado por 30 dias**.
3. Copie a string de conexão para `DATABASE_URL` (formato `postgresql://usuario:senha@host:5432/equapar?schema=public`).

Referência: [PostgreSQL 17: backup e restauração](https://www.postgresql.org/docs/17/backup.html).

## 2. Arquivos (bucket privado com versionamento)

1. Crie um bucket **privado** no **Amazon S3** (recomendado) e **ligue o versionamento** ([AWS: versionamento no S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)). Com ele, um arquivo apagado ou sobrescrito por engano pode ser recuperado.
2. Crie um usuário de acesso só a esse bucket e copie `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`.
3. Preencha `ARMAZENAMENTO=s3`, `S3_BUCKET` e `S3_REGION`.

**Cloudflare R2:** é compatível com a API S3, mas **não tem versionamento de objetos pela API S3**. Se usar o R2, a alternativa é uma cópia diária do bucket para outro bucket (ou outro provedor) com retenção de 30 dias. Por isso recomendamos o S3.

## 3. Domínio, HTTPS e e-mail

1. Confirme o registro do domínio **equapar.com** e aponte o DNS para a hospedagem (o painel da hospedagem diz quais registros criar).
2. Ative o **HTTPS** (a maioria das hospedagens emite o certificado sozinha). `APP_URL` precisa começar com `https://`.
3. Contrate um provedor de e-mail transacional (exemplos: Amazon SES, Postmark, Resend, Brevo) e configure no DNS do domínio:
   - **SPF** e **DKIM** (o provedor diz quais registros criar);
   - **DMARC** começando com `p=none` (só monitorar), por exemplo `v=DMARC1; p=none; rua=mailto:dmarc@equapar.com`;
   - DNS reverso e TLS, quando o provedor pedir.

   O Google exige SPF ou DKIM de qualquer remetente; acima de 5.000 mensagens por dia, SPF, DKIM e DMARC; e taxa de spam abaixo de 0,3%. Fonte: [Google: regras para remetentes de e-mail](https://support.google.com/a/answer/81126). Detalhes em `docs/operacao/email.md`.
4. Preencha `SMTP_URL` e `EMAIL_FROM` (ex.: `Equapar Avisos <avisos@equapar.com>`).

## 4. Variáveis de ambiente

1. Abra o `.env.example`: ele tem três blocos (**para subir**, **para vender**, **depois**), e cada variável diz o que é, onde se obtém, o formato e o que acontece vazia.
2. Preencha **no painel de segredos da hospedagem**. **Nunca** coloque valores no repositório.
3. Para começar a vender, preencha também `SITE_WHATSAPP`, `SITE_EMAIL_CONTATO`, `SITE_FUNDADOR_NOME` e `SITE_CIDADE`.
4. Preencha `TRUSTED_PROXY_HEADER` com o cabeçalho de IP da sua hospedagem (sem ele, os limites por IP ficam desligados).

## 5. Os dois processos

A imagem sai do `Dockerfile` do repositório (`docker build -t equapar .`).

1. **App:** use o comando padrão da imagem. Ele aplica as migrações do banco e sobe o sistema na porta 3000. Configure a verificação de saúde em `/api/saude`.
2. **Worker:** a mesma imagem com o comando `npm run worker:prod`, com **reinício automático** ligado (se ele parar, os avisos param e o `/api/saude` passa a responder 503 depois de 30 minutos de fila parada).

Um exemplo local completo está em `docker-compose.producao.yml` (app, worker e banco).

## 6. Verificação

Dentro da imagem (sem `--env-file`, porque o ambiente vem da hospedagem):

```
npm run verificar:producao:imagem
```

Fora dela, com um `.env`: `npm run verificar:producao`. Corrija toda linha **FALHA** e leia cada **AVISO**. Para testar o e-mail de verdade: `npm run verificar:producao -- --enviar-teste` (envia para os endereços de `PAINEL_EMAILS`), ou o botão "Enviar e-mail de teste" no painel interno.

## 7. Demonstração

Rode uma vez, na imagem: `npm run db:seed:demo:prod`. Ele cria só dados **fictícios** (a conta modelo da demonstração) e pode rodar de novo sem duplicar nada.

## 8. Primeiro acesso

1. Crie a conta do dono pelo **cadastro normal** do site (`/criar-conta`).
2. Ponha o e-mail do dono em `PAINEL_EMAILS` e reinicie: o painel interno (`/app/interno`) aparece.

## 9. Monitoramento

1. Um monitor externo (exemplos: UptimeRobot, Better Stack) chamando `https://equapar.com/api/saude` **a cada minuto**.
2. Alerta de erro em `ERROS_WEBHOOK_URL`. As mensagens não levam dados pessoais nem segredos.

## 10. Restauração (pelo menos uma vez)

Restaure o backup mais recente num **banco de teste** (nunca no de produção), aponte uma cópia do app para ele e confira se os dados abrem. Anote quanto tempo levou. O roteiro está em `docs/OPERACAO.md`.

## 11. Teste final

Do seu computador, contra o endereço público:

```
APP_URL=https://equapar.com npm run e2e:producao
```

Ele só lê: confere a home e os cabeçalhos de segurança, o `/api/saude`, as páginas públicas, a demonstração (uma vez) e a tela de login. Não cria conta, não envia e-mail e não usa dado real.

## 12. Quando sair o CNPJ

1. Preencha `SITE_RAZAO_SOCIAL`, `SITE_CNPJ` e `SITE_ENDERECO` e reinicie: termos, privacidade e rodapé passam a mostrar os dados da empresa, sem nova programação.
2. Abra a conta PJ no Asaas, teste no **sandbox** (`ASAAS_AMBIENTE` vazio e chave `$aact_hmlg_...`) e só depois passe para produção.
3. Emita a nota fiscal conforme a orientação do contador.
