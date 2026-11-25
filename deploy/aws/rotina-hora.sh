#!/usr/bin/env bash
# Rotina de hora em hora (cron do servidor): avisos de prazo, renovação e régua de cobrança, reservas de IA.
# Falha vai para o log do sistema (journalctl -t equapar-rotina) e para o CloudWatch (/equapar/app registra o erro).
set -uo pipefail
SEGREDO=$(grep -E '^CRON_SECRET=' /opt/equapar/.env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
R=$(curl -sS -m 300 -w ' http=%{http_code}' -H "Authorization: Bearer $SEGREDO" http://127.0.0.1:3000/api/cron/avisos 2>&1)
logger -t equapar-rotina "$R"
case "$R" in *http=200) exit 0 ;; *) exit 1 ;; esac
