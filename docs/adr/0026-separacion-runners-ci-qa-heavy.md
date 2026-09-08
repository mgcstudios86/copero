# ADR-0026 — Separación de runners por label: `copero-ci` / `copero-qa` / `copero-heavy`

- **Status**: accepted
- **Date**: 2026-09-08
- **Deciders**: devops (1626fb36), CEO (presupuesto en MGC-2268)
- **Supersedes**: ninguno
- **Refuerza**: ADR-0024 (auto-cancel stuck in_progress + runner watch), `docs/runners.md` (MGC-2092)
- **Related**: MGC-2226 (cola 24 min vs 68 s compute), MGC-2268 (aprobación presupuestaria), MGC-2466 (provisioning runner-03), MGC-2359 (queue saturation ≠ lease zombie), MGC-2440 (lease-zombie dual-runner)

## Contexto

La política de `docs/runners.md` (MGC-2092) declaró la separación
`copero-ci` (gate de merge) vs `copero-heavy` (QA Playwright + EAS), pero el
estado real de los runners la contradice. Consulta a la API el 2026-09-08:

```
copero-ci-runner-01  Linux  labels: self-hosted, Linux, X64, copero-ci, copero-heavy
copero-ci-runner-02  macOS  labels: self-hosted, copero-ci, macOS, ARM64, copero-heavy
```

Ambos runners cargan **las dos labels**. La consecuencia es que un job de QA
Playwright (30-65 min) o un `eas build --local` (20-40 min) puede tomar
cualquiera de los dos runners y dejar el gate de merge sin capacidad. Los
síntomas registrados:

- **MGC-2226**: jobs de `ci.yml` con 24 min en cola contra 68 s de compute
  real. El cuello no es el cómputo, es la disponibilidad del pool.
- **MGC-2359**: saturación de cola diagnosticada erróneamente como lease
  zombie. Con dos runners y tres clases de trabajo, "busy" es indistinguible
  de "colgado" sin inspección manual.
- **MGC-2440**: runner-01 y runner-02 `busy=true` simultáneo con 0 runs
  `in_progress` — el pool compartido amplifica el blast radius de un solo
  runner degradado a *todo* el pipeline, incluido el merge de hotfixes.

El cache de npm (MGC-2226) baja el tiempo de `typecheck` pero no crea
capacidad: con 6 jobs paralelos en `ci.yml` y 2 runners, la cola es
estructural.

## Decisión

### §1 — Tres clases de trabajo, tres labels, sin solapamiento

| Label | Trabajo | Duración típica | Criticidad |
|---|---|---|---|
| `copero-ci` | Gate de merge: `ci.yml`, `runner-watch.yml`, `purge-*.yml` | 1-5 min/job | **Bloquea merges** |
| `copero-qa` | Suites E2E: `qa.yml` (Playwright web, Maestro android) | 15-65 min | No bloquea merges |
| `copero-heavy` | Builds y releases: `eas.yml`, `release-internal.yml` | 20-40 min | No bloquea merges |

**Regla dura**: ningún runner declara más de una de estas tres labels. Un
runner con `copero-ci` **no** puede tener `copero-qa` ni `copero-heavy`.
La razón es la que motiva el ADR: una label compartida convierte capacidad
dedicada al gate de merge en capacidad consumible por jobs de 40 min.

`self-hosted`, `Linux`/`macOS`, `X64`/`ARM64` son labels de plataforma que el
agente asigna automáticamente y **sí** conviven con cualquiera de las tres.

### §2 — Asignación de runners

| Runner | Host | Clase |
|---|---|---|
| `copero-ci-runner-01` | VPS Oracle `146.235.246.167` | `copero-qa` |
| `copero-ci-runner-02` | Mac mini M4 local | `copero-heavy` |
| `copero-ci-runner-03` | Hetzner CX22 `mgcstudios-02` | `copero-ci` |

runner-03 queda como **único** proveedor de `copero-ci`. Esto es deliberado:
el gate de merge tiene capacidad dedicada y su cola es observable sin ruido
de otras clases. El riesgo (single point of failure del merge) se mitiga en §4.

runner-01 pasa a `copero-qa` porque Playwright ya tiene bootstrap
documentado ahí (`docs/runner-bootstrap.md`, MGC-1880) y sus 1 GB de RAM son
suficientes para Chromium headless pero no para `npm ci` de RN+Expo.
runner-02 (16 GB, ARM64) queda en `copero-heavy`: es el único host con
toolchain de EAS, keystore y sesión de Expo cacheada.

### §3 — Especificación de runner-03

- **Proveedor**: Hetzner Cloud CX22 (2 vCPU, 4 GB RAM, 40 GB SSD), ~$24/mes,
  aprobado por CEO en MGC-2268. Se evaluó Oracle Always Free ($0) y se
  descartó: los shapes AMD gratuitos tienen 1 GB de RAM (mismo OOM que
  runner-01 en MGC-1853) y los ARM Ampere no tienen disponibilidad
  sostenida en la región.
- **Labels**: `self-hosted, Linux, X64, copero-ci`. Nada más.
- **Sin toolchain de QA ni de builds nativos**: no Playwright, no Android
  SDK/NDK, no Xcode, no keystore, no sesión de Expo con credenciales. Sí
  `eas-cli` como paquete npm global, porque el job `build web` de `ci.yml`
  lo instala vía `scripts/install-eas-cli.sh` para el `expo export`. Si un
  job de `ci.yml` empieza a necesitar toolchain nativo, la respuesta es
  mover ese job a su clase, no engordar runner-03.
- **Swap 4 GB** con `vm.swappiness=10`: `npm ci` de RN+Expo pico ~2.5 GB;
  el swap es red de contención, no capacidad de trabajo.
- **Drop-in de systemd** `KillMode=control-group` + `TimeoutStopSec=120`
  (MGC-2091): sin esto, el stop del servicio deja el worker huérfano y el
  runner queda zombie (`status=online, busy=false`, sin pickup).
- **Provisioning**: `scripts/cloud-init/runner-03.yaml` (host) +
  `scripts/provision-runner-03.sh` (registro idempotente). El
  registration-token es efímero (1 h) y viaja por stdin del ssh: nunca en
  argv, ni en el historial, ni en la metadata del cloud provider.

### §4 — Mitigación del single point of failure en `copero-ci`

`runner-watch.yml` (ADR-0024 §2) ya alerta cuando hay runs `queued` > 5 min
sin runner disponible. Con runner-03 como único `copero-ci`, esa alerta pasa
a ser la señal de degradación del gate de merge.

Procedimiento de contingencia cuando runner-03 cae y hay un merge urgente
(por ejemplo un hotfix de producción):

1. Agregar temporalmente `copero-ci` a runner-01 o runner-02 vía
   `gh api -X PUT repos/mgcstudios/copero/actions/runners/{id}/labels`.
2. Mergear el hotfix.
3. **Quitar la label** en el mismo turno. Documentar en el ticket.

La label cruzada es una excepción con reversión explícita, no un estado
tolerado. Un runner que queda con label cruzada "por si acaso" reintroduce
exactamente el problema que este ADR resuelve.

### §5 — Verificación

La separación es verificable con un solo comando. Cualquier salida no vacía
es una violación del ADR:

```bash
gh api repos/mgcstudios/copero/actions/runners \
  --jq '.runners[]
        | {name, labels: [.labels[].name]}
        | select(
            ([.labels[] | select(. == "copero-ci" or . == "copero-qa" or . == "copero-heavy")] | length) > 1
          )'
```

## Consecuencias

**Positivas**

- El gate de merge tiene capacidad dedicada: la cola de `ci.yml` deja de
  depender de si alguien disparó QA o un build.
- La cola por clase es observable: `queued` en `copero-ci` significa
  "runner-03 degradado", sin ambigüedad con MGC-2359 / MGC-2440.
- Blast radius acotado: un runner degradado afecta una clase de trabajo.

**Negativas**

- +$24/mes de costo recurrente (aprobado en MGC-2268).
- `copero-ci` queda sin redundancia hasta que se provisione un runner-04.
  Mitigado por §4, pero el procedimiento es manual.
- Tres hosts que mantener (parches, rotación del PAT de Infisical cada 90 d).

**Neutrales**

- Cuatro `runs-on` cambian en el mismo PR. Los tres últimos son
  correcciones obligatorias: con las labels separadas, `[copero-ci, macOS]`
  no matchea ningún runner y el job quedaría `queued` indefinidamente.

  | Workflow | Antes | Después | Motivo |
  |---|---|---|---|
  | `qa.yml` | `copero-heavy` | `copero-qa` | Clase propia; Playwright ya bootstrapeado en runner-01 |
  | `purge-stale-runs.yml` | `copero-ci, macOS` | `copero-ci` | Housekeeping de API; no necesita macOS |
  | `release-internal.yml` (android) | `copero-ci, macOS` | `copero-heavy` | Release es clase heavy |
  | `release-internal.yml` (ios) | `copero-ci, macOS` | `copero-heavy, macOS` | iOS requiere Xcode; runner-02 es el único macOS heavy |

- `ci.yml`, `eas.yml`, `runner-watch.yml`, `runner-maintenance.yml` y
  `purge-stuck-inprogress.yml` ya declaran la label correcta para su clase.
- `runner-maintenance.yml` declara `[copero-ci, Linux]` y corre
  `install-eas-cli.sh`: sigue siendo válido en runner-03 (Linux, con
  eas-cli npm global).
