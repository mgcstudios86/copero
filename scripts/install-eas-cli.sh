#!/usr/bin/env bash
# MGC-696: instalación idempotente de eas-cli en runners self-hosted.
#
# Un job cancelado a mitad de `npm install -g eas-cli@latest` deja directorios
# temporales `.eas-cli-XXXX` dentro del node_modules global del runner. El
# siguiente install falla con `ENOTEMPTY: directory not empty, rename` porque
# npm no puede mover la instalación previa al nombre temporal ya ocupado.
# Como el runner es persistente, el error se repite en todos los jobs
# posteriores hasta que alguien limpia el directorio a mano.
#
# Estrategia: limpiar restos antes de instalar y, si el install igual falla,
# borrar la instalación previa completa y reintentar desde cero.
set -euo pipefail

NPM_GLOBAL_ROOT="$(npm root -g)"

rm -rf "${NPM_GLOBAL_ROOT}"/.eas-cli-* 2>/dev/null || true

if npm install -g eas-cli@latest; then
  echo "[install-eas-cli] eas-cli instalado: $(eas --version 2>/dev/null || echo desconocido)"
  exit 0
fi

echo "[install-eas-cli] WARN: install falló; limpiando instalación previa y reintentando" >&2
rm -rf "${NPM_GLOBAL_ROOT}/eas-cli" "${NPM_GLOBAL_ROOT}"/.eas-cli-* 2>/dev/null || true
npm install -g eas-cli@latest
echo "[install-eas-cli] eas-cli instalado tras limpieza: $(eas --version 2>/dev/null || echo desconocido)"
