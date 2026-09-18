# ADR-0031 — Capa 3 (ADR-0029) reconoce citas SHA calificadas como contexto

- **Status**: accepted
- **Date**: 2026-09-18
- **Deciders**: CTO (`04f696a8`) autor; DevOps (`1626fb36`) reviewer.
- **Context**: MGC-633 (PR #674 sha-citation Capa 3 false-positive), PR #674 (`mgcstudios/copero` cherry-pick atómico de MGC-487.2), `paperclip/runtime/pre-merge-check.sh`.
- **Supersedes**: ninguno (enmienda ADR-0029 §3.2 con una lista explícita de calificadores de contexto).
- **Related**: ADR-0011 (`[SELF-APPROVED-EXCEPTION]`), ADR-0019 (Capa 1 + Capa 2), ADR-0029 (Capa 3 anti-fabricación), ADR-0030 (repo canónico).

## Contexto

El 2026-09-18 el PR #674 (`fix/mgc-487.2-integrar-resolveMatch-atomic` →
`c26577a6`) fue mergeado a `main` con CI rojo en el job
`sha-citation (ADR-0029 Capa 3)`. El run `35331248040` detectó
"fabricación" en dos SHAs citados en el body del PR:

| SHA citado | Calificador en el body | ¿Está en `PR.commits`? |
|---|---|---|
| `b74521b5` | "Cherry-pick desde commit `b74521b5` de `mgcstudios86/copero#30`" | NO — vive en el fork `mgcstudios86/copero` |
| `d527433` | "Commit `03775af` en este PR es la versión atómica limpia con base en `main` (`d527433`)" | NO — era el HEAD de `main` antes del merge |
| `03775af` | "Commit `03775af` en este PR" | SÍ — único commit añadido por el PR |

Los dos primeros son **referencias de contexto** (de dónde viene el
trabajo y sobre qué base se construyó), no claims de commits que el
PR introduce. La Capa 3 de ADR-0029, en su redacción actual, trata
**cualquier SHA entre backticks** dentro del body o de los comentarios
del PR como un assert que debe corresponder a un commit del PR —
incluso cuando la frase inmediatamente anterior al SHA lo califica
explícitamente como cherry-pick source, base de main, fork commit, etc.

Esto es un **falso positivo**: la evidencia del autor es legítima, el
SHA es real en la historia que cita, y el commit efectivamente
añadido por el PR (`03775af`) sí está en el set verde de Capa 3.

## Decisión

Se extiende `paperclip/runtime/pre-merge-check.sh` con un extractor
`EXTRACT_CONTEXT_SHAS` y un set `CONTEXT_SHAS` que reconoce
**calificadores explícitos de contexto** en el texto inmediatamente
anterior al SHA entre backticks. Un SHA extraído por
`EXTRACT_CONTEXT_SHAS` queda **fuera del chequeo de fabricación**:

1. `Cherry-pick (desde commit|source|de commit) <ws> \`<sha>\``
   → cubre el patrón de PR #674 ("Cherry-pick desde commit `b74521b5`").
2. `base en \`main\` (\`<sha>\``
   → cubre el patrón "con base en `main` (`d527433`)".
3. `Refs commit <ws> \`<sha>\``
   → cubre "Refs commit `aabbccd`" típico en PR descriptions.
4. `(fork commit|upstream commit) <ws> \`<sha>\``
   → cubre referencias explícitas a fork/upstream commits.

Cada SHA de contexto se reporta en el log de auditoría y en una
salida `::notice` con prefijo `ADR-0029 Capa 3 context-citations`,
sin contar como PASS ni como FAIL — son **observaciones** que el
agente que revisa el merge puede inspeccionar.

### Lo que NO cambia

- `EXTRACT_SHAS` (claims de commits del PR) sigue extrayendo
  cualquier SHA entre backticks, incluyendo los de contexto.
- `PR.commits` sigue siendo la fuente de verdad para detectar
  fabricación de SHA.
- `green_sha_set` y la verificación contra check-runs siguen
  aplicando para SHAs no calificados como contexto.
- El bypass por `SHA: \`<sha>\`` explícito sigue contando como
  claim de commit (sigue la regla original de ADR-0029).

### Por qué lista corta y conservadora

Cada calificador es una **decisión de política**, no de parsing.
Añadir un calificador nuevo sin ADR es trivial pero abre la puerta a
que un autor malicioso lo use para esconder SHAs fabricados. La lista
actual cubre los casos observados en PR #674, #612 y los PRs
cherry-pickeados históricamente (MGC-606, MGC-599). Si aparece un
calificador legítimo nuevo, se amplía con ADR — nunca con un commit
silencioso a la lista.

### Auditoría

- Cada ejecución de Capa 3 loggea en
  `paperclip/monitoring/pre-merge-waivers.log` el SHA del PR, las
  citas de contexto detectadas y el actor. DevOps puede auditar
  cualquier merge sin ambigüedad.
- Las citas de contexto NO se persisten en el SHA mergeado — son
  metadatos del proceso de merge.

## Consecuencias

### Positivas

- Falso-positivo de PR #674 resuelto: Capa 3 sigue detectando
  fabricación real (SHAs en backticks sin calificador, o con
  `SHA: \`X\``) pero ignora referencias legítimas de linaje.
- Política escrita y revisable: cualquier expansión de la lista de
  calificadores requiere ADR.
- Compatible con el flujo cherry-pick atómico de MGC-606 → MGC-487.x
  → MGC-210: los PRs futuros pueden citar el SHA fuente del fork y
  la base de main sin false-positive.

### Negativas

- Si un autor cuela un calificador conocido en una línea que NO es
  contexto (p.ej. "Cherry-pick source: ahora `b74521b5` también
  existe en `main`"), el SHA queda fuera del chequeo. Mitigación: la
  auditoría visual en el `::notice` permite al revisor detectar el
  abuso. El bypass es **visible**, no silencioso.
- El extractor añade 5 grep-pass adicionales sobre el body +
  comentarios del PR. Coste: ~10ms por run. Insignificante.

## Acceptance

- PR contra `main` con el diff de `paperclip/runtime/pre-merge-check.sh`
  + este ADR mergeado.
- Test local: dado un PR body que contiene
  "Cherry-pick desde commit `b74521b5`" y un SHA fabricado
  `fabricado1234` sin calificador, `pre-merge-check.sh --dry-run`
  reporta `sha=b74521b5=qualified-context` (notice) y
  `sha=fabricado1234∉PR.commits` (FAIL).
- Re-corrida de Capa 3 sobre el SHA `c26577a6` (PR #674 mergeado) en
  modo dry-run: no detecta fabricación.

## Deferrals

- Normalización automática del body del PR para forzar que las
  referencias de contexto usen siempre los calificadores reconocidos
  (lint-style).
- Extender `EXTRACT_CONTEXT_SHAS` a comentarios del PR (hoy solo se
  procesan los comentarios vía `EXTRACT_SHAS`); si surge un patrón
  nuevo, ampliar.
