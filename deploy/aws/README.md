# Equapar na AWS (São Paulo, sa-east-1)

Montado em 25/11/2026 na conta "Equapar" (alias `equapar`). Ambiente atual: **homologação** (Asaas sandbox, IA desligada).
Nenhum segredo neste diretório: as variáveis ficam no Parameter Store, criptografadas.

## O que existe

| Peça | Nome | Observação |
|---|---|---|
| Servidor | EC2 `equapar-servidor` (t3.small, Amazon Linux 2023, disco 20 GB criptografado) | app + worker + Caddy (HTTPS) em Docker; sem SSH: acesso pelo Session Manager |
| IP fixo | Elastic IP `equapar-servidor` | endereço provisório `https://<ip com hífens>.sslip.io` |
| Banco | RDS `equapar-banco` (PostgreSQL 17, db.t4g.micro, 20 GB gp3) | privado, criptografado, backup diário 7 dias, proteção contra exclusão |
| Arquivos | S3 `equapar-arquivos-<conta>` | privado, versionado, criptografado; versões antigas somem em 30 dias |
| Imagens | ECR `equapar` | guarda as 10 últimas; varredura de vulnerabilidades no envio |
| Variáveis | Parameter Store `/equapar/<ambiente>/env` (SecureString), `/imagem`, `/dominio`, `/db-senha` | o servidor lê ao subir |
| Logs | CloudWatch `/equapar/app`, `/equapar/worker`, `/equapar/caddy` | 30 dias |
| Alarmes | `equapar-servidor-recuperar`, `equapar-servidor-reiniciar` | recuperação/reinício automáticos do EC2 |
| Custos | orçamento `Equapar-Mensal` (US$ 80) | avisos por e-mail em 85%, 100% e previsão de 100% |
| E-mail | SES, identidade `equapar.com.br`, MAIL FROM `envio.equapar.com.br` | precisa dos registros de DNS e da liberação de produção |
| Permissões do servidor | papel `equapar-servidor` | só: imagem do ECR, o bucket da Equapar, `/equapar/*` no Parameter Store, os logs, Session Manager |

## Publicar uma versão nova

```bash
TAG=$(git rev-parse --short HEAD)
docker build -t equapar:$TAG .
REG=<conta>.dkr.ecr.sa-east-1.amazonaws.com
aws ecr get-login-password --profile equapar --region sa-east-1 | docker login --username AWS --password-stdin $REG
docker tag equapar:$TAG $REG/equapar:$TAG && docker push $REG/equapar:$TAG
aws ssm put-parameter --profile equapar --region sa-east-1 --name /equapar/homolog/imagem --value $TAG --overwrite
aws ssm send-command --profile equapar --region sa-east-1 --instance-ids <id> --document-name AWS-RunShellScript \
  --parameters 'commands=["/opt/equapar/atualizar.sh"]'
```

O app aplica as migrações ao subir; o worker só sobe depois do app saudável. Para voltar uma versão, ponha a tag anterior em `/imagem` e rode `atualizar.sh`.

## Mudar uma variável

Edite `/equapar/homolog/env` no Parameter Store (console ou `aws ssm put-parameter --overwrite`) e rode `/opt/equapar/atualizar.sh` no servidor. O arquivo é `CHAVE=valor`, um por linha, sem aspas nem escape (formato raw: `$aact_…` vai como está).

## Entrar no servidor

`aws ssm start-session --profile equapar --region sa-east-1 --target <id>` (precisa do plugin do Session Manager), ou pelo console: EC2 → a instância → Conectar → Session Manager. Os arquivos ficam em `/opt/equapar`.

## Recriar o servidor do zero

`deploy/aws/gerar-user-data.sh homolog > user-data.sh` e um EC2 novo com esse user-data, o papel `equapar-servidor`, o grupo de segurança `equapar-servidor` e o IP fixo. Ele instala o Docker, baixa as variáveis e a imagem e sobe tudo; a rotina de hora em hora fica no cron (`/etc/cron.d/equapar`, minuto 7).
