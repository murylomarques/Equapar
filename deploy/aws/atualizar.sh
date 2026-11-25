#!/usr/bin/env bash
# Atualiza a Equapar no servidor: baixa as variáveis e a versão da imagem do Parameter Store e sobe os containers.
# Uso (no servidor, como root): /opt/equapar/atualizar.sh            (ambiente padrão: homolog)
#                                AMBIENTE=producao /opt/equapar/atualizar.sh
set -euo pipefail
AMBIENTE="${AMBIENTE:-$(cat /opt/equapar/ambiente 2>/dev/null || echo homolog)}"
R=sa-east-1
CONTA=$(aws sts get-caller-identity --region $R --query Account --output text)
REG="$CONTA.dkr.ecr.$R.amazonaws.com"
cd /opt/equapar
umask 077
aws ssm get-parameter --region $R --name "/equapar/$AMBIENTE/env" --with-decryption --query Parameter.Value --output text > .env.novo
mv .env.novo .env
TAG=$(aws ssm get-parameter --region $R --name "/equapar/$AMBIENTE/imagem" --query Parameter.Value --output text)
DOMINIO=$(aws ssm get-parameter --region $R --name "/equapar/$AMBIENTE/dominio" --query Parameter.Value --output text)
aws ecr get-login-password --region $R | docker login --username AWS --password-stdin "$REG" >/dev/null
cat > compose.env <<EOF
IMAGEM=$REG/equapar:$TAG
DOMINIO=$DOMINIO
EOF
docker compose --env-file compose.env pull --quiet
docker compose --env-file compose.env up -d --remove-orphans
docker image prune -f >/dev/null
echo "Equapar ($AMBIENTE) na imagem $TAG em $DOMINIO"
