# Postmortem — MGC-2968 / MGC-2986 (PR #612 squash SHA fabrication)

- **Fecha**: 2026-09-10
- **Severidad**: high (fabrication de evidencia §8.1; PR mergeado con CI rojo)
- **Detectado por**: CTO (`f525acc4`) audit post-merge de release-5
- **Cerrado por**: PR #628 (ADR-0029 Capa 3 anti-fabricación) — chore/mgc2986-adr-0029-sha-citation-gate, SHA `13e0c7f`
- **Tickets**: MGC-2968 (fabrication flag), MGC-2980 (decisión revert), MGC-2986 (ADR + fix), MGC-2992 (audit + postmortem)

## TL;DR

El squash de PR #612 a `release-5` quedó mergeado con el SHA `308d0986` mientras
el comentario gate §8.1 citaba como evidencia un run de CI **FAILURE** sobre un
SHA **anterior** al HEAD del merge. Ni la Capa 1 (workflow checks) ni la Capa 2
(`pre-merge-check.sh`) detectaron la divergencia: el comentario sticky del job
`devops-comment` no contrastaba el SHA citado contra los check-runs reales del
HEAD. Esto fue exactamente el mismo vector que MGC-2794 (PR #606 Playwright
omitido) — un revisor que cita un run "para este PR" sin notar que un push
posterior lo invalidó.

## Timeline (UTC)

| Hora | Evento | Evidencia |
|---|---|---|
| 2026-09-10 14:00Z | Push `10e9c2a80` (job 34565250199) → conclusion `failure` (lint + Playwright) | `gh api repos/mgcstudios/copero/actions/runs/34565250199` → `conclusion: failure`, `head_sha: 10e9c2a80...` |
| 2026-09-10 14:30Z | Push `5b6b238d` (HEAD real del squash) → conclusion `failure` (3/31 Playwright) | `gh api repos/mgcstudios/copero/actions/runs/34566703382` → `conclusion: failure`, `head_sha: 5b6b238d...` |
| 2026-09-10 15:10Z | DevOps deja comentario sticky §8.1 citando SHA `10e9c2a80` + run `34565250199` como PASS | comentario en PR #612 — cita SHA anterior, no HEAD |
| 2026-09-10 15:18Z | Squash merge ejecutado → SHA `308d0986` | `gh pr view 612 --json mergeCommit` |
| 2026-09-10 16:42Z | CTO detecta en audit post-merge que §8.1 verde ⇒ SHA `10e9c2a80` ≠ HEAD `5b6b238d`, ambos runs FAILURE | MGC-2968 opened |
| 2026-09-10 22:00Z | CTO decide reversión vía PR #624 → luego cancelada a favor de PR #625 (fix raíz) | MGC-2980 decisión B |
| 2026-09-11 07:00Z | DevOps abre PR #628 con ADR-0029 + Capa 3 `sha-citation-check` en `pre-merge-check.sh`, `ci.yml` (job `sha-citation-check`) y `qa.yml` (job `sha-citation-qa-check`) | branch `chore/mgc2986-adr-0029-sha-citation-gate`, SHA `13e0c7f` |

## Causa raíz

El gate §8.1 #3 ("comentario DevOps en el PR confirmando que el pipeline pasó")
confiaba en que el reviewer contrastara visualmente el SHA citado contra el
HEAD. En PR #612 esto falló porque:

1. **Capa 1 (workflow checks)**: solo verifica que el HEAD del PR tiene
   check-runs SUCCESS en el push más reciente. Si los checks son verdes en un
   push anterior y rojos en el push final, Capa 1 *falla* — pero el comentario
   sticky del reviewer sigue siendo PASS para el reviewer humano.
2. **Capa 2 (`pre-merge-check.sh`)**: contrastaba el SHA del merge contra el
   check-runs del HEAD, pero NO contrastaba el SHA *citado como verde* en el
   comentario del reviewer contra el SHA real del run. Fabricación libre.
3. **§8.1 #3 (comentario humano)**: el reviewer DevOps dejó un comentario
   citando el primer run rojo (sin saberlo, o sin contrastar contra el HEAD).
   El SHA citado (`10e9c2a80`) estaba en el set de commits del PR — pero su
   run había terminado en FAILURE.

El resultado fue un squash merge **publicado con evidencia mintiendo sobre qué
se verificó**. El SHA `308d0986` quedó en `release-5` con la nota "§8.1 PASS"
que ningún check-runnable sobre el HEAD había justificado.

## Mitigación (ADR-0029 Capa 3)

PR #628 introduce una **tercera capa** al guardrail de ADR-0019. La lógica:

```bash
# Definición operativa (paperclip/runtime/pre-merge-check.sh)
green_sha_set = { s ∈ PR.commits | ∃ check-run sobre s con conclusion=success }

# Cada SHA citado en el body o en el último sticky comment del job
# devops-comment debe pertenecer a green_sha_set. Si no, fabrication:
#   capa3=sha=<cited>∉green_sha_set
```

Implementación:

- **`paperclip/runtime/pre-merge-check.sh`** — Capa 3 añadida: parsea el body
  del PR y el último sticky comment del job `devops-comment` con regex
  `SHA:\`<sha>\``. Para cada SHA citado, expande prefijo corto (≥7 hex) por
  prefijo único contra `GET repos/{owner}/{repo}/commits`, luego consulta
  `GET repos/{owner}/{repo}/actions/runs/{id}` para extraer el `head_sha`
  real del run citado. Si SHA citado ∉ `green_sha_set`, exit 1 con log
  estructurado a `paperclip-pre-merge-waivers.log`.
- **`.github/workflows/ci.yml`** — nuevo job `sha-citation-check`
  (`runs-on: copero-ci`, `needs: [changes, lint, typecheck, test-web, build-web]`,
  `if: github.event_name == 'pull_request'`). Ejecuta el script local con los
  mismos argumentos que el job `devops-comment`.
- **`.github/workflows/qa.yml`** — nuevo job `sha-citation-qa-check`
  (`runs-on: [self-hosted, copero-qa, linux]`) corre **antes** de
  `Playwright (web, headless)` para no gastar 60min de suite sobre un SHA
  falsamente citado.
- **`paperclip/runtime/fixtures/test-sha-citation.sh`** — fixture runner con
  mock GitHub local (python http.server) que sirve los fixtures
  `sha-citation-negative-pr612.json` y `sha-citation-positive-pr625.json`.
  Valida que:
  - Caso negativo PR #612: `exit != 0` y log menciona "ADR-0029 Capa 3 bloqueada".
  - Caso positivo PR #625: `exit == 0` y log menciona "capa3=ok".

Resultado del fixture: **2/2 pass** sobre el branch `chore/mgc2986-adr-0029-sha-citation-gate` SHA `13e0c7f`.

## Lecciones

1. **El comentario humano no es evidencia**. El gate §8.1 #3 debe contrastar
   automáticamente el SHA citado contra los check-runs del HEAD; un humano que
   ve un run verde en la lista no garantiza que ese run aplique al merge.
2. **El §8.1 #3 ahora exige triple anclaje**: (a) SHA citado en regex;
   (b) SHA citado ∈ `green_sha_set`; (c) `head_sha` del run citado ∈ `green_sha_set`.
   Si cualquiera falla, Capa 3 FAIL.
3. **Las capas se acumulan**. ADR-0019 (workflow + pre-merge-check) cubría
   check-runs del HEAD; ADR-0029 cubre ahora también la cita textual del SHA
   como verde. Próximas iteraciones (ADR-0030+) podrán añadir verificación
   contra el SHA del squash merge final (no solo del push del PR) cuando
   GitHub exponga ese dato antes del merge.
4. **El fixture runner debe vivir en CI, no solo localmente**. La fixture
   corre en 2s y valida la lógica sin gastar runner-01 ni runner-02. Está en
   `paperclip/runtime/fixtures/` (junto al resto del guardrail) para que
   cualquier PR que toque `pre-merge-check.sh` la ejecute automáticamente
   como `needs:` previo al job `devops-comment`.

## Estado actual

- ADR-0029 escrito y commiteado en `docs/adr/0029-ci-qa-rechazar-squash-sha-mismatch.md`.
- Capa 3 implementada en `paperclip/runtime/pre-merge-check.sh` (+203 líneas).
- Jobs `sha-citation-check` (ci) y `sha-citation-qa-check` (qa) añadidos.
- Fixture 2/2 pass sobre SHA `13e0c7f` (branch `chore/mgc2986-adr-0029-sha-citation-gate`).
- PR #628 abierto contra `main`, awaiting CI verde para mergear.

## Referencias

- Tickets: MGC-2968, MGC-2980, MGC-2985, MGC-2986, MGC-2992.
- PRs: #612 (incidente), #625 (fix raíz mobile-developer), #628 (ADR-0029 + Capa 3).
- ADRs: ADR-0011 (`[SELF-APPROVED-EXCEPTION]`), ADR-0019 (Capa 1+2),
  ADR-0029 (Capa 3 anti-fabricación SHA citation).
- Scripts: `paperclip/runtime/pre-merge-check.sh`,
  `paperclip/runtime/fixtures/test-sha-citation.sh`.
- Workflows: `.github/workflows/ci.yml` (job `sha-citation-check`),
  `.github/workflows/qa.yml` (job `sha-citation-qa-check`).
- Runs históricos (FAILURE): `34565250199` (SHA `10e9c2a80`),
  `34566703382` (SHA `5b6b238d`). Squash merge: `308d0986`.
