#!/usr/bin/env bash
# MGC-2466 — provisioning de runner-03 (mgcstudios-02) para la cola `copero-ci`.
#
# Idempotente: si el runner ya está registrado con los labels correctos, sale 0
# sin tocar nada. Si está registrado con labels distintos, lo re-registra.
#
# Requisitos en la máquina que ejecuta el script (no en el host destino):
#   - `gh` autenticado con scope `repo` sobre mgcstudios/copero.
#   - `ssh` con acceso al host destino (clave del operador).
#
# Uso:
#   scripts/provision-runner-03.sh --host <ip-o-alias> [--user runner] [--dry-run]
#
# El registration-token se pide en el momento (validez 1 h) y viaja por stdin
# del ssh: nunca queda en argv, ni en el historial, ni en la metadata del cloud.
set -euo pipefail

REPO="mgcstudios/copero"
RUNNER_NAME="copero-ci-runner-03"
# Labels: `copero-ci` únicamente. NO copero-qa, NO copero-heavy (ADR-0026).
# `self-hosted`, `Linux` y `X64` los agrega el agente automáticamente según el
# host; los declaramos igual para que `config.sh` falle si el host no matchea.
RUNNER_LABELS="copero-ci"
RUNNER_VERSION="2.336.0"
RUNNER_DIR="actions-runner-copero-03"

HOST=""
SSH_USER="runner"
DRY_RUN=0

die() { printf 'error: %s\n' "$*" >&2; exit 1; }
log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="${2:-}"; shift 2 ;;
    --user) SSH_USER="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) die "flag desconocido: $1" ;;
  esac
done

[[ -n "$HOST" ]] || die "falta --host (IP o alias ssh de mgcstudios-02)"
command -v gh >/dev/null || die "gh no está instalado"
command -v ssh >/dev/null || die "ssh no está instalado"

# ---------------------------------------------------------------------------
# 1. Estado actual: ¿el runner ya existe con los labels correctos?
# ---------------------------------------------------------------------------
log "consultando runners registrados en $REPO"
existing="$(gh api "repos/$REPO/actions/runners" \
  --jq ".runners[] | select(.name==\"$RUNNER_NAME\") | {id, status, labels: [.labels[].name]}" || true)"

if [[ -n "$existing" ]]; then
  current_labels="$(printf '%s' "$existing" | jq -r '.labels | sort | join(",")')"
  expected_labels="$(printf 'self-hosted\nLinux\nX64\ncopero-ci\n' | sort | paste -sd, -)"
  if [[ "$current_labels" == "$expected_labels" ]]; then
    log "$RUNNER_NAME ya registrado con labels correctos ($current_labels) — nada que hacer"
    exit 0
  fi
  log "$RUNNER_NAME registrado con labels [$current_labels], esperados [$expected_labels] — re-registro"
  runner_id="$(printf '%s' "$existing" | jq -r '.id')"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    gh api -X DELETE "repos/$REPO/actions/runners/$runner_id"
  else
    log "(dry-run) DELETE repos/$REPO/actions/runners/$runner_id"
  fi
fi

# ---------------------------------------------------------------------------
# 2. Token de registro efímero.
# ---------------------------------------------------------------------------
log "solicitando registration-token (validez 1 h)"
if [[ "$DRY_RUN" -eq 1 ]]; then
  REG_TOKEN="DRY_RUN_TOKEN"
else
  REG_TOKEN="$(gh api -X POST "repos/$REPO/actions/runners/registration-token" --jq '.token')"
  [[ -n "$REG_TOKEN" ]] || die "no se pudo obtener registration-token"
fi

# ---------------------------------------------------------------------------
# 3. Instalación remota. El token entra por stdin, no por argv.
# ---------------------------------------------------------------------------
remote_script=$(cat <<REMOTE
set -euo pipefail
read -r REG_TOKEN

RUNNER_DIR="\$HOME/$RUNNER_DIR"
TARBALL="actions-runner-linux-x64-$RUNNER_VERSION.tar.gz"
URL="https://github.com/actions/runner/releases/download/v$RUNNER_VERSION/\$TARBALL"

# Arquitectura: el tarball es x64. Si el host es ARM, abortar antes de bajar
# 200 MB que no sirven.
arch="\$(uname -m)"
[ "\$arch" = "x86_64" ] || { echo "error: host es \$arch, este script provisiona x64" >&2; exit 1; }

mkdir -p "\$RUNNER_DIR"
cd "\$RUNNER_DIR"

# Si ya hay un servicio corriendo de un registro previo, pararlo y desinstalarlo
# antes de reconfigurar (config.sh falla si .runner existe).
if [ -f ./svc.sh ]; then
  sudo ./svc.sh stop  || true
  sudo ./svc.sh uninstall || true
fi
if [ -f ./config.sh ] && [ -f .runner ]; then
  ./config.sh remove --token "\$REG_TOKEN" || rm -f .runner .credentials .credentials_rsaparams
fi

if [ ! -f ./config.sh ]; then
  curl -sSfL -o "\$TARBALL" "\$URL"
  tar -xzf "\$TARBALL"
  rm -f "\$TARBALL"
fi

# Dependencias nativas del agente (libicu, etc.).
sudo ./bin/installdependencies.sh

./config.sh \
  --url "https://github.com/$REPO" \
  --token "\$REG_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --work _work \
  --runnergroup default \
  --replace \
  --unattended

sudo ./svc.sh install "\$(whoami)"

# MGC-2091: el override de systemd (KillMode=control-group) lo escribe
# cloud-init en /etc/systemd/system/actions.runner.service.d/. El nombre real
# de la unidad incluye el repo, así que reubicamos el drop-in al path exacto.
unit="\$(systemctl list-units --type=service --all --no-legend 'actions.runner.*' | awk '{print \$1}' | head -1)"
if [ -n "\$unit" ] && [ -f /etc/systemd/system/actions.runner.service.d/override.conf ]; then
  sudo install -d "/etc/systemd/system/\$unit.d"
  sudo cp /etc/systemd/system/actions.runner.service.d/override.conf \
    "/etc/systemd/system/\$unit.d/override.conf"
  sudo systemctl daemon-reload
fi

sudo ./svc.sh start
sleep 5
sudo ./svc.sh status || true
REMOTE
)

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "(dry-run) el script remoto que se ejecutaría en $SSH_USER@$HOST:"
  printf '%s\n' "$remote_script"
  exit 0
fi

log "instalando y registrando $RUNNER_NAME en $SSH_USER@$HOST"
# El script viaja base64 en argv (no es secreto) y el token por stdin (sí lo es:
# en argv quedaría visible en `ps` del host destino).
remote_b64="$(printf '%s\n' "$remote_script" | base64 | tr -d '\n')"
printf '%s\n' "$REG_TOKEN" | ssh -o StrictHostKeyChecking=accept-new \
  "$SSH_USER@$HOST" \
  "printf '%s' '$remote_b64' | base64 -d > /tmp/provision-runner-03.sh && bash /tmp/provision-runner-03.sh; rc=\$?; rm -f /tmp/provision-runner-03.sh; exit \$rc" || \
  die "el registro remoto falló"

# ---------------------------------------------------------------------------
# 4. Verificación desde la API.
# ---------------------------------------------------------------------------
log "verificando registro"
for _ in $(seq 1 12); do
  out="$(gh api "repos/$REPO/actions/runners" \
    --jq ".runners[] | select(.name==\"$RUNNER_NAME\") | {name, status, busy, os, labels: [.labels[].name]}" || true)"
  if [[ -n "$out" ]]; then
    printf '%s\n' "$out"
    status="$(printf '%s' "$out" | jq -r '.status')"
    [[ "$status" == "online" ]] && { log "$RUNNER_NAME online"; exit 0; }
  fi
  sleep 5
done

die "$RUNNER_NAME no aparece online tras 60 s — revisar 'sudo ./svc.sh status' en el host"
