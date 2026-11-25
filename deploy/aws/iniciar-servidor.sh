#!/usr/bin/env bash
# Primeira inicialização do EC2 (Amazon Linux 2023), usado como user-data junto com os arquivos de deploy/aws
# (gerar-user-data.sh embute docker-compose.yml, Caddyfile, atualizar.sh e rotina-hora.sh abaixo de __ARQUIVOS__).
set -euxo pipefail
AMBIENTE=__AMBIENTE__

dnf install -y docker cronie
systemctl enable --now docker crond
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL https://github.com/docker/compose/releases/download/v2.39.1/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# 2 GB de swap: folga para o app e o worker numa máquina de 2 GB
if [ ! -f /swapfile ]; then fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab; fi

mkdir -p /opt/equapar && cd /opt/equapar
echo "$AMBIENTE" > ambiente
base64 -d <<'__ARQUIVOS__' | tar -xz -C /opt/equapar
__CONTEUDO__
__ARQUIVOS__
chmod 700 atualizar.sh rotina-hora.sh

# rotina de hora em hora (minuto 7) e atualização das variáveis a cada reinício
echo '7 * * * * root /opt/equapar/rotina-hora.sh' > /etc/cron.d/equapar
cat > /etc/systemd/system/equapar.service <<'EOF'
[Unit]
Description=Equapar (docker compose)
After=docker.service network-online.target
Requires=docker.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/opt/equapar/atualizar.sh
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable equapar.service
# a imagem pode ainda não estar no ECR: tenta por até 30 minutos
for i in $(seq 1 60); do /opt/equapar/atualizar.sh && break; sleep 30; done
