# Inventario de runners self-hosted — Copero

Fuente de verdad del pool de runners y sus labels. La política que gobierna la
separación por clase es **ADR-0026**; este documento describe el estado.
El bootstrap paso a paso vive en `docs/runner-bootstrap.md`.

Última verificación contra la API: **2026-09-08**.

## Hosts

| Runner | ID | Host | OS / arch | vCPU | RAM | Clase | Estado |
|---|---|---|---|---|---|---|---|
| `copero-ci-runner-01` | 29 | `146.235.246.167` (Oracle Cloud VPS, `mgcstudios-01`) | Ubuntu 24.04 x86_64 | 2 | 1 GB | `copero-qa` | online |
| `copero-ci-runner-02` | 3 | `192.168.68.71` (Mac mini M4 local) | macOS 26 ARM64 | 8 | 16 GB | `copero-heavy` | online |
| `copero-ci-runner-03` | — | `mgcstudios-02` (Hetzner CX22) | Ubuntu 24.04 x86_64 | 2 | 4 GB | `copero-ci` | pendiente de provisioning |

## Matriz de labels

`self-hosted` + la label de plataforma (`Linux`/`macOS`, `X64`/`ARM64`) las
asigna el agente automáticamente. La label de **clase** es la que se declara
explícitamente en `config.sh --labels` y es exactamente una por runner.

| Label | runner-01 | runner-02 | runner-03 | Workflows que la consumen |
|---|---|---|---|---|
| `copero-ci` | — | — | ✅ | `ci.yml`, `runner-watch.yml`, `runner-maintenance.yml`, `purge-stale-runs.yml`, `purge-stuck-inprogress.yml` |
| `copero-qa` | ✅ | — | — | `qa.yml` |
| `copero-heavy` | — | ✅ | — | `eas.yml`, `release-internal.yml` |
| `Linux` | ✅ | — | ✅ | `runner-maintenance.yml` |
| `macOS` | — | ✅ | — | `release-internal.yml` (job iOS) |
| `ARM64` | — | ✅ | — | ninguno declara ARM64 explícitamente |
| `X64` | ✅ | — | ✅ | ninguno declara X64 explícitamente |

**Ninguna celda de clase tiene dos ✅ en la misma columna.** Eso es la
invariante de ADR-0026: un runner, una clase. Verificación:

```bash
gh api repos/mgcstudios/copero/actions/runners \
  --jq '.runners[]
        | {name, labels: [.labels[].name]}
        | select(
            ([.labels[] | select(. == "copero-ci" or . == "copero-qa" or . == "copero-heavy")] | length) > 1
          )'
```

Salida vacía = OK. Cualquier runner listado viola el ADR.

## Toolchain por host

| Capacidad | runner-01 (`copero-qa`) | runner-02 (`copero-heavy`) | runner-03 (`copero-ci`) |
|---|---|---|---|
| Node 20/22 | ✅ | ✅ | ✅ |
| `eas-cli` (npm global) | ✅ | ✅ | ✅ (para `expo export` de `build web`) |
| Playwright + Chromium | ✅ | ✅ (residual) | ❌ deliberado |
| Android SDK / NDK / JDK 17 | ❌ | ✅ | ❌ deliberado |
| Xcode | ❌ | ✅ | ❌ (no es macOS) |
| Keystore + sesión Expo | ❌ | ✅ | ❌ deliberado |
| Swap | no | no (16 GB físicos) | 4 GB, `swappiness=10` |
| Drop-in systemd `KillMode=control-group` | ✅ (MGC-2091) | n/a (launchd) | ✅ (cloud-init) |

runner-01 tiene 1 GB de RAM: alcanza para Chromium headless pero **no** para
`npm ci` de RN+Expo (~25 min, y `build web` OOM a los 13 min). Es la razón por
la que no puede servir `copero-ci` de forma sostenida y por la que se descartó
Oracle Always Free para runner-03 (mismo perfil de 1 GB).

## Provisioning de runner-03

```bash
# 1. Crear el servidor con el cloud-init (reemplazar la pubkey placeholder antes).
#    Hetzner: Ubuntu 24.04, tipo cx22, user-data = scripts/cloud-init/runner-03.yaml

# 2. Registrar el runner (idempotente; --dry-run para inspeccionar primero).
scripts/provision-runner-03.sh --host <ip-de-mgcstudios-02> --dry-run
scripts/provision-runner-03.sh --host <ip-de-mgcstudios-02>

# 3. Verificar labels.
gh api repos/mgcstudios/copero/actions/runners \
  --jq '.runners[] | {name, status, busy, os, labels: [.labels[].name]}'
```

El script es idempotente: si runner-03 ya está registrado con
`self-hosted, Linux, X64, copero-ci`, sale 0 sin tocar nada. Si tiene labels
distintas, lo elimina de la API y lo re-registra.

## Reasignación de labels de runner-01 y runner-02

El estado actual (2026-09-08) tiene **las tres labels cruzadas**:

```
copero-ci-runner-01  labels: self-hosted, Linux, X64, copero-ci, copero-heavy
copero-ci-runner-02  labels: self-hosted, copero-ci, macOS, ARM64, copero-heavy
```

La convergencia a ADR-0026 requiere reasignar labels vía API. **Hacerlo solo
después de que runner-03 esté online**: si se quita `copero-ci` de runner-01 y
runner-02 antes, el gate de merge queda sin ningún runner elegible.

```bash
# Orden obligatorio: primero runner-03 online, después estos dos.
# runner-01 → copero-qa
gh api -X PUT repos/mgcstudios/copero/actions/runners/29/labels \
  -f 'labels[]=copero-qa'
# runner-02 → copero-heavy
gh api -X PUT repos/mgcstudios/copero/actions/runners/3/labels \
  -f 'labels[]=copero-heavy'
```

`PUT .../labels` reemplaza las labels custom y preserva las de plataforma
(`self-hosted`, `Linux`/`macOS`, `X64`/`ARM64`), que son read-only.

## Contingencia: runner-03 caído con merge urgente

`copero-ci` queda sin redundancia (ADR-0026 §4). Si runner-03 cae y hay un
hotfix que mergear:

1. `gh api -X POST repos/mgcstudios/copero/actions/runners/3/labels -f 'labels[]=copero-ci'`
2. Mergear el hotfix.
3. `gh api -X DELETE repos/mgcstudios/copero/actions/runners/3/labels/copero-ci`

El paso 3 no es opcional. Una label cruzada que queda "por si acaso"
reintroduce la saturación de cola de MGC-2226.

`runner-watch.yml` (ADR-0024 §2) alerta cuando hay runs `queued` > 5 min sin
runner disponible: esa es la señal de que runner-03 está degradado.

## Diagnóstico: cola saturada vs lease zombie

Confundir los dos casos llevó a recovery innecesario en MGC-2359 y MGC-2440.

| Síntoma | Cola saturada | Lease zombie |
|---|---|---|
| `busy` | `true` | `true` |
| Runs `in_progress` en la API | ≥ 1 | **0** |
| Daemon (`svc.sh status` / journal) | healthy, procesando | healthy pero sin pickup |
| Acción | esperar slot o cancelar runs redundantes | recovery de MGC-2273 |

`busy=true` con **0** runs `in_progress` es lease zombie. Con la separación de
ADR-0026 el diagnóstico se simplifica: cada clase tiene un solo runner, así que
"cola de `copero-ci`" y "runner-03 degradado" son el mismo evento.

## Mantenimiento

- **PAT de Infisical** (`INFISICAL_TOKEN` en GitHub Secrets): rotar cada 90 d.
- **Binario del agente**: `actions/runner` se auto-actualiza; el pin de
  `provision-runner-03.sh` (`2.336.0`) es solo para el bootstrap inicial.
- **Restos de `eas-cli`**: `runner-maintenance.yml` (dispatch manual) limpia
  los `.eas-cli-XXXX` que rompen jobs con `ENOTEMPTY`.
- **Billing**: tras cualquier cambio de `runs-on`, confirmar en
  `https://github.com/organizations/mgcstudios/settings/billing` que los
  minutos GH-hosted no incrementan. Cualquier minuto nuevo = un job cayó a
  un runner hosted por una label que no matchea.
