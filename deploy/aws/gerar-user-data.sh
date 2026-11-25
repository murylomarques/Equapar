#!/usr/bin/env bash
# Gera o user-data do EC2: iniciar-servidor.sh com os arquivos de deploy/aws embutidos (tar.gz em base64).
# Uso: deploy/aws/gerar-user-data.sh homolog > user-data.sh
set -euo pipefail
cd "$(dirname "$0")"
AMBIENTE="${1:-homolog}"
CONTEUDO=$(tar -cz docker-compose.yml Caddyfile atualizar.sh rotina-hora.sh | base64 -w 76)
awk -v amb="$AMBIENTE" -v cont="$CONTEUDO" '{ gsub("__AMBIENTE__", amb); if ($0 == "__CONTEUDO__") print cont; else print }' iniciar-servidor.sh
