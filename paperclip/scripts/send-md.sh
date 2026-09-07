#!/usr/bin/env bash
# send-md.sh — Copero (ADR-0025, MGC-2191)
# Envía un mensaje Markdown a Telegram vía Bot API.
#
# Uso:
#   send-md.sh [--dry-run] "mensaje markdown"
#   echo "mensaje" | send-md.sh [--dry-run]
#
# Resolución de credenciales (orden):
#   1. $TELEGRAM_BOT_TOKEN + $TELEGRAM_CHAT_ID (env).
#   2. INFISICAL: secrets del proyecto mgcstudios (path según topic-infisical-copero-path).
#      Se requiere `infisical` CLI en PATH; si no está, falla con mensaje claro.
#
# Política §8.3: corre en self-hosted runner copero-ci o mac-mini del operador.
# Sin secreto hardcoded; nunca leer `.env` (skill `paperclip` §1.10).

set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  shift
fi

# Si no hay argumento posicional pero hay stdin, leemos stdin.
if [[ $# -lt 1 ]]; then
  MSG=$(cat)
else
  MSG="$1"
fi

if [[ -z "${MSG:-}" ]]; then
  echo "ERROR: mensaje vacío" >&2
  exit 2
fi

resolve_creds() {
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    return 0
  fi
  if command -v infisical >/dev/null 2>&1; then
    eval "$(infisical export --projectId=df11f16d-e5f9-4b6f-a7c7-9a9f304a0a39 \
      --path=/copero --env=prod --format=dotenv 2>/dev/null \
      | sed -E 's/^(TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID)=/export \1=/')"
  fi
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    echo "ERROR: TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID requeridos (env o Infisical)" >&2
    return 1
  fi
}

resolve_creds || exit 3

# Telegram Bot API: 4096 chars max por mensaje; truncamos conservadoramente.
MAX_CHARS=3500
if [[ "${#MSG}" -gt "$MAX_CHARS" ]]; then
  MSG="${MSG:0:$MAX_CHARS}"$'\n\n_…(truncado)_'
fi

# Telegram no parsea Markdown de GitHub; usamos JSON mode con entity hints básicos.
# Para mensajes multi-línea con Markdown ligero, usamos parse_mode=HTML escapando.
HTML=$(printf '%s' "$MSG" \
  | awk '{
      gsub(/&/, "\\&amp;");
      gsub(/</, "\\&lt;");
      gsub(/>/, "\\&gt;");
      gsub(/```/, "\n<code>");
      print
    }')

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY-RUN send-md.sh"
  echo "chat_id=${TELEGRAM_CHAT_ID:-<unset>}"
  echo "bot_token_len=${#TELEGRAM_BOT_TOKEN}"
  echo "msg_len=${#MSG}"
  echo "--- payload preview (first 200 chars) ---"
  printf '%s' "$MSG" | head -c 200
  echo
  echo "---"
  exit 0
fi

RESP=$(curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "parse_mode=HTML" \
  --data-urlencode "text=${HTML}" \
  --max-time 10) || {
  echo "ERROR: curl fallo contra api.telegram.org" >&2
  exit 4
}

OK=$(printf '%s' "$RESP" | jq -r '.ok // false')
if [[ "$OK" != "true" ]]; then
  echo "ERROR: Telegram API devolvio no-ok: $RESP" >&2
  exit 5
fi

printf '%s' "$RESP" | jq -r '.result.message_id // "sent"'
