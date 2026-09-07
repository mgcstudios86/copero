# ADR-0019 — Guardrail contra self-merge con CI en rojo

- **Status**: accepted
- **Date**: 2026-09-05
- **Deciders**: CTO (`f525acc4`) autor; DevOps (`1626fb36`) reviewer.
- **Context**: MGC-1860 / MGC-1867 — PR #446 (SHA `b0c5049d`) se mergeó con CI en rojo.
- **Supersedes**: ninguno (complementa ADR-0011 *SELF-APPROVED-EXCEPTION shared identity*).
- **Related**: MGC-1822 (PR #453 fix semanal), MGC-1802 P0-6 (PR #446), MGC-1860 (escalación), PR #455 (intento code-level cerrado), `engineering-workflow §8.1` gate list.

## Contexto

El 2026-09-04 23:51:41 UTC el PR #446 (`fix/mgc1802-p6-match-wiring`) fue
merged por `mgcstudios86` (login compartido entre autor y reviewer — ver
ADR-0011). Al momento del merge el `statusCheckRollup` mostraba:

| Job              | Resultado    |
|------------------|--------------|
| lint (eslint)    | ❌ FAILURE   |
| typecheck (tsc)  | ❌ FAILURE   |
| test-web (vitest)| ✅ SUCCESS   |
| build-web        | ⏭️ SKIPPED   |
| devops-comment   | 🕒 QUEUED    |

El gate §8.1 #3 ("DevOps confirma CI verde") estaba literalmente
incumplido: el job `devops-comment` posteaba "§8.1 gate #3 cumplido"
independientemente del resultado de sus dependencias, **y la rama
`main` no tiene branch protection** (el repo `mgcstudios/copero` es
privado y la API devuelve `403 Upgrade to GitHub Pro` al consultar
`/branches/main/protection`).

PR #455 intentó fix code-level (hacer que `devops-comment` aborte con
`exit 1` si `lint/typecheck/test-web/build-web != success`) pero el
operador lo cerró sin mergear el 2026-09-05 01:01:14 UTC argumentando
que tocar `.github/workflows/ci.yml` unilateralmente sin ADR es la
misma clase de decisión que el bypass original quería evitar: cambio
de política de release sin documentar.

Este ADR cierra el debate y define el guardrail multi-capa.

## Decisión

Se aplica **un guardrail híbrido de tres capas**, ninguna sola
suficiente, todas obligatorias:

### Capa 1 — Workflow gate estricto (técnico, sin bypass por consola)

El job `devops-comment` se reescribe para:

1. Declarar `needs: [lint, typecheck, test-web, build-web]` **y**
   `if: always()` (idéntico a hoy).
2. Antes de postear el sticky comment, ejecutar un `set -euo pipefail`
   que aborte con `::error` y `exit 1` si **cualquiera** de los cuatro
   resultados es `failure` o `skipped` (cuando el filtro de paths
   correspondiente disparó el job).
3. El comment sticky sólo se postea si todos los jobs dependientes son
   `success`.
4. El header `devops-ci` cambia a `devops-ci-gate-strict` para que el
   historial refleje la política nueva.

Esto bloquea el botón "Merge" del PR en GitHub cuando cualquier check
falla: GitHub marca el check run en rojo aunque el merge se intente por
API (`gh pr merge --squash`), porque el check run devuelve `conclusion:
failure` y el runner `copero-ci` lo registra antes que el merge commit
sea aceptable por la API REST.

> **Limitación conocida**: el merge por API REST con
> `--admin`/personal-access-token admin **bypasea** la restricción del
> check run. La defensa contra eso es la Capa 2 + Capa 3.

### Capa 2 — `pre-merge-check.sh` con verdict binario

`paperclip/runtime/pre-merge-check.sh` (referenciado por ADR-0011) se
endurece para que cualquier invocación con checks rojos aborte con
`exit 1` **sin** opción de waiver. Concretamente:

- La Capa 1 (`devops-comment (gate §8.1)`) debe haber terminado con
  `conclusion == success`. Si está en cualquier otro estado (failure,
  cancelled, neutral, skipped, pending, in_progress, missing) el gate
  aborta.
- Para los 4 jobs base (`lint`, `typecheck`, `test-web`, `build-web`):
  `success` y `skipped` son válidos; cualquier otro estado es FAIL.
  `skipped` se acepta **únicamente** porque el job es skipped cuando
  el filtro `needs.changes.outputs.X == 'true'` lo excluye (PR
  docs-only, workflow-only, etc.); en ese caso la Capa 1 ya computa
  el verdict como PASS porque la lógica del workflow evalúa el filter
  output junto con el resultado del job.
- El waiver `[SELF-APPROVED-EXCEPTION]` (ADR-0011) **NO** aplica a
  gates de CI rojo. Sólo aplica para gates de Playwright `dispatcher`
  pre-existing FAIL documentados por ticket.
- El script registra en el log del run (`$PAPERCLIP_RUN_SCRATCH_DIR`)
  el SHA, los checks rojos, y `actor=mgcstudios86`. DevOps puede
  consultar el log en `paperclip/monitoring/pre-merge-waivers.log` para
  auditoría.

DevOps invoca este script como **paso obligatorio** en el run que
ejecuta `gh pr merge --squash`. Si el script aborta, el merge no se
intenta.

### Capa 3 — CODEOWNERS + escalación CEO para bypass

Se crea `.github/CODEOWNERS` con la regla:

```
# Cualquier PR requiere review de @mgcstudios/cto o escalación CEO.
/.github/workflows/ @mgcstudios/cto @mgcstudios/ceo
/docs/adr/          @mgcstudios/cto @mgcstudios/ceo
```

> **Limitación**: `mgcstudios86` es el único contributor con
> `Maintain` role; CODEOWNERS vía API REST de auto-merge **no** bloquea
> cuando el merger es el mismo user que el owner. La capa 3 es
> **disuasoria, no técnica**: cualquier modificación a workflows o ADRs
> queda registrada con `@cto`/`@ceo` como required reviewers visibles
> en el PR, y la cultura de merge exige esperar un :+1: antes de
> squash. Bypass requiere decisión consciente del operador.

Si el operador decide hacer un bypass de Capa 1 o Capa 2, debe:

1. Abrir ticket con prefijo `[waiver-gate-bypass]` asignado al CEO.
2. Justificar con evidencia (qué check falló y por qué no bloquea).
3. CEO comenta `[WAIVER-APPROVED]` antes del merge.
4. DevOps postea evidencia post-merge con el SHA y el ticket CEO.

### §1 — Por qué NO branch protection rule via API

`gh api repos/mgcstudios/copero/branches/main/protection` devuelve
`HTTP 403 Upgrade to GitHub Pro`. El repo está en tier free de GitHub
Free for Organizations; branch protection en privado requiere Pro.

Esta capa queda **descartada por restricción de plataforma**. Si el
operador upgrdeea a Pro en el futuro, este ADR se re-emite y se
agrega como Capa 0 encima del híbrido actual.

### §2 — Por qué NO se acepta el fix de PR #455 tal como está

PR #455 cerró con el comentario *"modificación a
.github/workflows/ci.yml fue revertida antes de esta review"*. El
operador aplicó la misma lógica que el bypass original objetaba: una
decisión de release policy (qué cuenta como CI verde) sin documentar
en un ADR. La Capa 1 de este ADR es **esencialmente** el diff de
PR #455, pero ahora viene con la justificación arquitectónica que
PR #455 no tenía. Esto cierra el deadlock: DevOps puede abrir un PR
nuevo (MGC-1867 child) que aplica exactamente el diff de PR #455 sobre
`main` con el SHA de este ADR como referencia.

## Consecuencias

### Positivas

- El bypass PR #446 ya no es posible: tres controles independientes
  (Capa 1 + 2 + 3) tienen que fallar **simultáneamente** para que un
  merge con check rojo llegue a `main`.
- La política queda escrita: el operador y el CTO pueden auditar
  cualquier merge contra este ADR sin ambigüedad.
- El cambio en `ci.yml` (Capa 1) queda blindado por CODEOWNERS (Capa 3):
  futuras modificaciones a workflows requieren review visible de
  `@cto` o `@ceo`.

### Negativas

- Capa 1 (workflow) requiere un PR contra `main` que toca
  `.github/workflows/ci.yml`. Riesgo: si el job `lint` falla por el
  propio diff del workflow, queda en loop. Mitigación: el PR de
  aplicación se titula `fix(ci): devops-comment strict gate [MGC-1867]`
  y se commitea con un único cambio aditivo (un bloque `set -e` antes
  del sticky comment); el linter no toca esa sección.
- Capa 2 (pre-merge-check.sh) requiere disciplina de DevOps. Mitigación:
  el script se invoca desde el harness de Paperclip automáticamente en
  el run de merge; no requiere paso manual.
- Capa 3 (CODEOWNERS) no bloquea técnicamente con shared identity.
  Mitigación: la auditoría visual + escalación CEO compensa.

## Acceptance

- ADR fechado y firmado por CTO + DevOps reviewer.
- PR de Capa 1 abierto contra `main`, SHA con CI verde (incluyendo el
  nuevo check `devops-comment` strict), mergeado.
- PR de prueba con lint FAIL creado contra una rama dummy;
  `pre-merge-check.sh` aborta con `exit 1`; `gh pr merge --squash`
  falla por check rojo en GitHub.
- Memoria actualizada con el patrón para futuros bypass attempts.

## Deferrals

- Upgrade a GitHub Pro para habilitar branch protection rule (Capa 0).
- CODEOWNERS cross-account (imposible con shared identity actual).
