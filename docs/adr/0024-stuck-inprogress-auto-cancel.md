# ADR-0024 — Auto-cancel stuck in_progress jobs + runner watch

- **Status**: accepted
- **Date**: 2026-09-06
- **Deciders**: devops (1626fb36)
- **Context**: MGC-2159 — runner-01 zombie pattern (jobs detect-changed-paths no es el zombie real; los stuck son downstream: Playwright 65min, smoke-android 6min)
- **Supersedes**: ninguno
- **Related**: MGC-2091 (runner-01 systemd killmode), MGC-2159 (wake ticket), ADR-0018 (release flow)

## Contexto

El 2026-09-06 entre 04:39 y 05:55 UTC, el runner-01 (id=25, Linux self-hosted en VPS `mgcstudios-deploy`) ejecutó jobs `ci (copero)` y `qa (copero)` que quedaron zombies 8h+ en `in_progress`. El patrón observado en el journal:

- `detect changed paths` corre en **1-2 minutos** (filter dorny/paths-filter) y termina OK. **No es zombie**.
- El zombie real son los jobs downstream que cuelgan:
  - `Playwright (web, headless)` quedó 65min in_progress antes de cancelar
  - `smoke android (lint + typecheck + config validate)` quedó 6min in_progress antes de cancelar
- Tras cancelar el job stuck, el runner entra en estado zombie donde `status=online, busy=false` pero no toma nuevos jobs encolados durante 5-15min.
- El kill/restart del servicio systemd (que aplica el `KillMode=control-group + TimeoutStopSec=120` de MGC-2091) recupera el runner, pero **no hay alerta** que avise al operador ni auto-cancel.

## Decisión

### §1 — Cancelar automáticamente `in_progress` jobs con > 30min sin progreso

Crear workflow `purge-stuck-inprogress.yml` que corre cada 15min en `runner-01`:

1. Lista runs `in_progress` con `started_at` hace más de 30min.
2. Para cada run, lista jobs; si **todos** los jobs están `queued` o `waiting` (ninguno corrió realmente), cancela el run entero.
3. Si hay jobs en `in_progress` pero **no hay steps corriendo** (logs sin output > 5min), cancela esos jobs específicos.
4. Loguea cada cancelación con SHA, duración acumulada, jobs afectados y motivo.
5. Threshold configurable vía `vars.STUCK_THRESHOLD_MINUTES` (default 30).

No cancela jobs `in_progress` con steps activos en los últimos 5min — evita cancelar builds en progreso legítimo.

### §2 — Alerta cuando runner-01 está `busy=false` con jobs queued > 5min

Crear workflow `runner-watch.yml` que corre cada 5min:

1. Lista self-hosted runners con label `copero-ci`.
2. Lista runs en `queued` con `created_at` hace más de 5min.
3. Si hay runs queued y todos los runners `copero-ci` están `busy=false`, abre issue Paperclip `[MGC-<n>]-[runner-stuck-<short-reason>]` asignado a devops con severidad `high` y descripción del estado.
4. Idempotente: solo abre un nuevo issue si el último de la serie está cerrado/done (evita spam).

### §3 — `purge-stale-runs.yml` (existente) se mantiene

El workflow existente que cancela runs `queued` sin PR vivo se mantiene tal cual — cubre el patrón de "PR cerrado pero dispatch quedó encolado" (MGC-346, MGC-351, MGC-410). El nuevo §1 cubre `in_progress` stuck, no se solapan.

### §4 — No tocar el patrón `detect changed paths`

El job `detect changed paths` NO requiere cambios: corre rápido y termina OK. El framing del ticket MGC-2159 confundió "detect-changed-paths" con el job zombie real. La solución aplica a TODO job `in_progress` stuck, no solo a detect-changed-paths.

## Consecuencias

**Positivas**:
- Cola se libera automáticamente sin intervención manual del operador.
- Runner-01 no queda zombie 5-15min entre cancel y re-toma.
- Paperclip recibe alerta estructurada cuando el patrón se reproduce.

**Negativas / trade-offs**:
- Threshold de 30min puede cancelar builds legítimamente largos (`eas build --local` puede tomar 25-30min). Mitigación: si se observa cancelación falsa, subir threshold a 45min vía `vars.STUCK_THRESHOLD_MINUTES`.
- El alert workflow puede abrir muchos issues si el patrón se reproduce. Mitigación: la idempotencia del §2.4 evita duplicados consecutivos.

## Implementación

Archivos a crear en `mgcstudios/copero`:

1. `.github/workflows/purge-stuck-inprogress.yml`
2. `.github/workflows/runner-watch.yml`
3. `docs/adr/0024-stuck-inprogress-auto-cancel.md` (este archivo)

PR: abrir contra `main` con título `ci(workflows): auto-cancel stuck in_progress + runner watch (ADR-0024)`. Asignar a devops (este issue).
