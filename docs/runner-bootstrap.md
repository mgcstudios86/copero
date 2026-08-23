# Runner bootstrap — Copero CI

Tres runners self-hosted atienden los workflows `ci (copero)` y (en transición) `qa`:

| Runner | Host | OS | vCPU | RAM | Label |
|---|---|---|---|---|---|
| `copero-ci-runner-01` | `146.235.246.167` (Oracle Cloud VPS) | Ubuntu 24.04 x86_64 | 2 | 1 GB | `self-hosted,Linux,X64,copero-ci` |
| `copero-ci-runner-02` | `192.168.68.71` (Mac mini local M4) | macOS 26 ARM64 | 8 | 16 GB | `self-hosted,copero-ci,macOS,ARM64` |
| `mac-mini-pipeline-runner` | `192.168.68.71` (Mac mini local M4) | macOS 26 ARM64 | 8 | 16 GB | `self-hosted,macOS,ARM64` |

Runner-01 (VPS) tiene 1 GB RAM — `npm ci` para RN+Expo tarda ~25 min y el
job `build web` falla por OOM tras 13 min. Los runners del Mac mini (M4,
16 GB) corren `npm ci` en **~4 s** y completan `build web` en **~30 s**.

## Registro de un nuevo runner

1. Solicitar token al repo:
   ```bash
   TOKEN=$(gh api -X POST /repos/mgcstudios/copero/actions/runners/registration-token \
     | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
   ```
2. Descargar binarios ARM64 (o x64 según host):
   ```bash
   mkdir -p ~/actions-runner-copero-XX && cd ~/actions-runner-copero-XX
   curl -sSfL -o runner.tar.gz \
     https://github.com/actions/runner/releases/download/v2.336.0/actions-runner-osx-arm64-2.336.0.tar.gz
   tar -xzf runner.tar.gz && rm runner.tar.gz
   ```
3. Configurar:
   ```bash
   ./config.sh --url https://github.com/mgcstudios/copero \
     --token "$TOKEN" --name copero-ci-runner-XX \
     --labels copero-ci --work _work --runnergroup default --unattended
   ```
4. Instalar como servicio launchd (auto-arranca en boot):
   ```bash
   ./svc.sh install $(whoami)
   ./svc.sh start
   ```
5. Verificar:
   ```bash
   gh api /repos/mgcstudios/copero/actions/runners | jq '.runners[] | {name,status,busy,os}'
   ```

## Secretos (Infisical)

Los workflows leen `INFISICAL_TOKEN` (secret) y `INFISICAL_PROJECT_ID`
(variable) desde GitHub Secrets. El token es PAT del operador con scope
`org:read` sobre el proyecto Infisical `/copero`. Rotar el PAT cada 90 d.

## Estado actual (2026-08-23)

- Runner-01 (VPS): estable; usado como fallback cuando el Mac está apagado.
- Runner-02 (Mac mini): registrado en MGC-329; reduce `npm ci` 25 min → 4 s
  y desbloquea paralelismo entre jobs de `ci (copero)`.
- `mac-mini-pipeline-runner`: pre-existente, etiqueta genérica.
