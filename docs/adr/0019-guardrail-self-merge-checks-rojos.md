# ADR-0019 — Guardrail contra self-merge con checks rojos (MGC-1861)

- **Status**: accepted
- **Date**: 2026-09-05
- **Deciders**: CTO (`f525acc4`); revisor DevOps (`1626fb36`) por
  implementabilidad.
- **Context**: MGC-1860 (origen), MGC-1861 (parent), MGC-1865
  (implementación DevOps), PR #446 (`b0c5049d` self-merge con
  `lint` + `typecheck` FAILED + devops-comment QUEUED), PR #455
  (intento code-level, revertido por linter tras tocar `ci.yml`),
  PR #456 (implementación vigente).
- **Supersedes**: ninguno.
- **Related**: ADR-0011 (identity shared reviewer + `pre-merge-check.sh`
  waiver), `release-and-risk.md` §8.1, `PRE_MERGE_OK=1`.

## Contexto

PR #446 (`b0c5049d`) mergeo contra `main` con dos checks rojos
(`lint` + `typecheck`) y el comentario DevOps aún en estado `QUEUED`.
El operador detectó el bypass el 2026-09-05 (MGC-1860) y se escaló a
CTO (MGC-1861). El fix code-level inicial fue PR #455, que modificaba
el job de devops-comment dentro de `.github/workflows/ci.yml`. El
linter interno del repo (`actionlint` + convención) revirtió el
cambio en una pasada automática y la PR se cerró sin mergear.

El incidente demostró un fallo de **diseño del guardrail**, no del
script:

1. La gate `devops-comment` vivía como job dentro del mismo workflow
   `ci.yml`. Si `validate` fallaba, GitHub igual exponía el job
   `devops-comment` como `success` si su único step (post de comentario)
   no dependía explícitamente de `validate`. Sin el enlace
   `needs: [validate]` no había relación causal.
2. `pre-merge-check.sh` (ADR-0011) evalúa `gh pr view --json reviewDecision`
   + existencia de devops-comment PASS, pero **no consulta el campo
   `statusCheckRollup`**. Un check `FAILED`/`PENDING`/`QUEUED` no se
   considera fallo de Gate 3.
3. CODEOWNERS no estaba aplicado al path de workflows, así que un
   self-merge del repo owner (`mgcstudios86`) pasaba sin review humana
   incluso en archivos críticos de CI.

La protección correcta requiere **decisión arquitectural** (ADR-level),
no parche local: tres capas que cubren tres modos de bypass distintos.

## Decisión

Adoptamos **guardrail híbrido de 3 capas**. Cada capa cubre un modo
de bypass distinto; las tres son necesarias y se documentan
explícitamente para que ninguna se obvie por simplificación futura.

### §1 — Capa 1: Workflow `devops-comment.yml` independiente

**Problema cubierto**: bypass por acoplamiento del job al workflow
que estamos protegiendo.

**Decisión**: extraer la gate `devops-comment` de `.github/workflows/ci.yml`
a un archivo nuevo `.github/workflows/devops-comment.yml`, separado,
que cumple tres requisitos:

1. **`on: pull_request`** sobre `main` (mismo trigger, scope reducido).
2. **`needs: [validate]`** explícito contra el job del workflow
   `ci.yml` (cross-workflow `needs` requiere que ambos expongan un
   `job-level name`; el job `validate` ya lo tiene). Si
   `validate` está `FAILED`/`PENDING`, el job `verdict` queda en
   `skipped`/`failed`.
3. **Step `verdict`** calcula:
   - `validate.conclusion == 'success'` → exit 0 (`verdict=PASS`)
     y comentario con anchor `[DEVOPS-GATE-PASS]`.
   - cualquier otro caso (`failure`, `cancelled`, `skipped`,
     `timed_out`, o cualquier check required en estado distinto de
     `success`) → exit 1 (`verdict=FAIL`) y comentario con
     anchor `[DEVOPS-GATE-FAIL]` + lista de checks rojos.

**Implementación actual**: PR #456 (`ca46ca3`, branch
`fix/mgc1865-devops-guardrail-branch-protection-strict`, +139/-51
en 2 archivos: `.github/workflows/devops-comment.yml` nuevo + script
auxiliar). CI en `QUEUED` al momento de redactar este ADR; merge
queda sujeto a Gate 2 PASS de reviewer + CI verde.

### §2 — Capa 2: Extensión de `pre-merge-check.sh` (ADR-0011)

**Problema cubierto**: bypass por `gh pr merge` ejecutado desde una
shell local sin pasar por la UI de GitHub, donde `branch protection`
no aplica. El script ya es la red de seguridad **fuera de GitHub**.

**Decisión**: extender `paperclip/runtime/pre-merge-check.sh` para
incorporar dos cambios:

1. **Exit 2** (no `exit 1`) cuando algún check required aparece en el
   `statusCheckRollup` con `conclusion != 'success'` o `status` en
   `PENDING|QUEUED|IN_PROGRESS`. Esto distingue bloqueante (rojo)
   de rechazos previos por waiver (otro exit).
2. **Whitelist explícita**: aceptar checks `success` aunque el job
   `validate` haya sido re-llamado por push posterior al PR head.
   Si el SHA del merge es exactamente el SHA del último `success`
   completo, OK. Si hay checks posteriores QUEUED (push al branch
   del PR), FAIL con `[DEVOPS-GATE-FAIL] checks stale`.

Estos cambios **no requieren tocar `ci.yml`**, así que el linter
interno no los revierte (script vive en `paperclip/runtime/`, no en
`./.github`).

### §3 — Capa 3: CODEOWNERS + branch protection (futuro)

**Problema cubierto**: bypass por self-merge cuando el reviewer y
autor son el mismo login (waiver ADR-0011). El script permite la
excepción con `[SELF-APPROVED-EXCEPTION]`, pero la cultura objetivo
es revisión humana para paths críticos.

**Decisión**: posponer CODEOWNERS enforcement sobre
`.github/workflows/**` hasta confirmación del CEO. Razón: la regla
toca RBAC (categoría reservada POLICIES §3, escala CEO). ADR-0019
no la impone unilateralmente. Mientras tanto, el comentario DevOps
capa 1 sigue siendo obligatorio y toda modificación a workflows
queda registrada en PR review.

### §4 — Por qué tres capas y no una

| Bypass | Capa 1 (workflow) | Capa 2 (script) | Capa 3 (CODEOWNERS) |
|---|---|---|---|
| `lint`/`typecheck` FAILED + devops-comment `success` acoplado | ✅ | ✅ | — |
| `gh pr merge` local sin pasar UI | — | ✅ | — |
| Self-merge con comentario DevOps PASS | — | ✅ (whitelist CI) | ✅ (a futuro) |
| Push al branch del PR después del head SHA | ✅ (re-cancela verdict) | ✅ | — |

Cada capa cubre un vector que las otras dos no ven. Sacar cualquiera
deja un hueco explotable con la cadena actual `gh` + `gh-actions`
+ `linter`.

### §5 — Por qué script y no solo branch protection API

La opción **(a) `required_status_checks`** vía API GitHub
(`PUT /repos/{owner}/{repo}/branches/main/protection`) protege
merges vía UI de GitHub pero **no** merges vía `gh pr merge` desde
shell local: GitHub Actions aplica branch protection en ambos, pero
la implementación interna del check `_verdict_` depende de que
`statusCheckRollup.conclusion === 'success'`. Si el job de devops-comment
reporta `success` prematuramente (bug del workflow), branch protection
también lo aceptaría. La capa 2 (script) inspecciona el SHA y los
checks uno por uno.

La opción **(b) script local** es la única que sobrevive a un bug en
el workflow. Es la única defensa contra `merge` automatizado por
cualquier engineer (incluido el CTO) sin necesidad de UI.

La opción **(c) CODEOWNERS** no es bloqueante por sí sola: un reviewer
puede aprobar accidentalmente un PR con checks rojos. Por eso la
capa 3 va combinada con script.

### §6 — Acción inmediata y diferida

**Inmediato**:

- Mergear PR #456 una vez CI `success` y review APPROVED.
- Aplicar §2 a `paperclip/runtime/pre-merge-check.sh` en PR aparte
  (DevOps titula, branch corta desde `main`).
- Actualizar `release-and-risk.md` §8.1 con la nueva numeración: Gate
  3 ahora considera `statusCheckRollup`, no solo devops-comment.

**Diferido**:

- CODEOWNERS para `.github/workflows/**` (escalado CEO, ticket
  independiente con `parentId` a `MGC-1861`).
- UI check de la capa 3 vía GitHub native required reviewers (idéntico
  a CODEOWNERS, mismo bloqueo).

### §7 — Métrica de éxito

- Próximos 30 días: 0 PR mergeados con cualquier check required en
  estado `failure`/`pending` al SHA del merge. Verificable con
  `gh pr list --state merged --json number,mergeCommit,statusCheckRollup
  --jq '.[] | select(.statusCheckRollup[]?.conclusion != "success")'`.
- Si el contador pasa de 0 en el periodo, reabrir MGC-1861 como
  `in_progress` y revisar la capa fallida.

## Consecuencias

### Positivas

- El bypass estructural de PR #446 queda cerrado por tres vectores
  independientes. Cada uno refuerza al otro.
- El script `pre-merge-check.sh` gana un exit code semántico
  (`exit 2` = checks rojos vs `exit 1` = waiver rechazado) que ayuda
  a debugging cuando un merge falla.
- La separación del workflow `devops-comment.yml` reduce el riesgo
  de que un cambio en `ci.yml` rompa el guardrail (responsabilidades
  aisladas).
- ADR queda como precedente para futuros bypasses: patrón
  `workflow → script → CODEOWNERS` se reutiliza en cualquier nueva
  categoría crítica.

### Negativas

- Tres capas = tres lugares para mantener. Mitigación: DevOps
  documenta cada layer en `paperclip/runtime/README.md` con su orden
  de aplicación. No aceptamos "capas decorativas": cada una
  documenta un bypass concreto que cubre.
- Split del workflow introduce un punto de coordinación cross-job.
  Si `ci.yml` renombra el job `validate`, `devops-comment.yml` debe
  actualizarse al mismo commit. Mitigación: comentario en `ci.yml`
  referenciando `devops-comment.yml`, anclado por CODEOWNERS futuro.
- CODEOWNERS queda deferido. Si el operador quiere enforcement
  inmediato, escalar ticket al CEO.

### Trade-offs aceptados

- Toleramos **latencia +1** entre el push y la decisión de merge
  (workflow extra) a cambio de **segregación** del guardrail. Es un
  costo fijo de ~30s en CI; aceptable para main.
- Aceptamos que el guardrail agrega fricción a self-merges urgentes
  (hotfix). Hotfix branches deben pasar por el gate igual;
  ADR-0011 ya trata ese caso con `[SELF-APPROVED-EXCEPTION]`.

## Deferrals

- CODEOWNERS enforcement sobre `.github/` (categoría reservada,
  CEO).
- `gh-actions-watcher` para runners self-hosted (P3, no urgente).
- Migración de `gh pr merge` local a GitHub API con branch
  protection re-validado server-side (P4, esperar GH feature).

## Acceptance

- ADR fechado y firmado.
- PR #456 mergeado con CI `success` y review APPROVED.
- PR sub-siguiente (DevOps) que extiende `pre-merge-check.sh` con
  exit 2 mergeado.
- `release-and-risk.md` §8.1 actualizado con Gate 3 nuevo.
- Memoria `MGC-1867-ADR-0019-self-merge-guardrail.md` creada en el
  índice del proyecto con cross-ref a MGC-1860/1865 y enlaces a
  PR #446 + PR #456.
