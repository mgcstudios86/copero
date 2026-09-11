# ADR-0029 — Rechazar squash con SHA citado que no está en el set CI-verde del PR

- **Status**: accepted
- **Date**: 2026-09-11
- **Deciders**: DevOps (`1626fb36`) autor; CTO (`f525acc4`) reviewer.
- **Context**: MGC-2986 (fabrication flag), MGC-2968 (PR #612 squash), MGC-2794 (PR #606 Playwright omitido).
- **Supersedes**: ninguno (refuerza ADR-0019 Capa 1+2 con Capa 3 anti-fabricación).
- **Related**: ADR-0011 (`[SELF-APPROVED-EXCEPTION]`), ADR-0019 (Capa 1 workflow / Capa 2 pre-merge-check), `paperclip/runtime/pre-merge-check.sh`, `MGC-2622/MGC-2640/MGC-2645/MGC-2662/MGC-2673/MGC-2545/MGC-2546/MGC-2629` (fabrication flags históricos).

## Contexto

El 2026-09-10 el PR #612 fue squash-mergeado a `release-5` con SHA
`308d0986`. El comentario "CI verde" del agente DevOps citaba el run
`34565250199` (conclusión `FAILURE`) sobre el SHA `10e9c2a80` — un
commit anterior del PR, **no** el HEAD real del merge (`5b6b238d`,
sobre el cual el run `34566703382` también terminó en `FAILURE` con
3/31 specs Playwright en rojo). El gate §8.1 #3 cerró como verde a
pesar de que ningún check-runnable en el SHA final había aprobado
(verificación de evidencia en MGC-2968 / MGC-2986).

Esto reproduce el patrón de MGC-2794 (PR #606 Playwright omitido):
la **Capa 2 de ADR-0019 valida check-runs del HEAD del PR**, pero
nadie contrasta el SHA *citado como verde* en el comentario del
reviewer (o en el body del PR) contra el SHA real sobre el cual ese
run ejecutó. Si el reviewer cita un SHA anterior al HEAD —porque vio
un run verde "para este PR" sin notar que un push posterior lo
invalidó—, el merge queda falsamente autorizado.

El riesgo no es técnico: es **fabricación**. Un squash merge
publica un SHA nuevo en `main`; si el comentario DevOps cita un run
sobre otro SHA, el historial de evidencia queda mintiendo sobre qué
se verificó. La detección debe ser automática porque la verificación
manual no escala y ya ha fallado dos veces.

## Decisión

Se añade una **Capa 3 al guardrail ADR-0019**: el script
`paperclip/runtime/pre-merge-check.sh` y los workflows `ci.yml` /
`qa.yml` deben **rechazar** cualquier merge donde el SHA citado como
"CI verde" (en el body del PR, en un comentario sticky del job
`devops-comment`, o en un comentario marcado por el reviewer) no
pertenezca al set de SHAs que tienen un check-run verde en el rango
del PR.

### Definición operativa

1. **Set verde**: `green_sha_set = { s ∈ PR.commits | ∃ check-run
   sobre `s` con conclusión `success` }`. Si un SHA no está en este
   set, citarlo como "CI verde" es fabricación.
2. **Citas obligatorias**: el job `devops-comment` deja un comentario
   sticky con un bloque `SHA: \`<sha>\``. La Capa 3 parsea ese bloque
   (regex `SHA:\s*\`([0-9a-f]{7,40})\``) y exige que el SHA extraído
   ∈ `green_sha_set`.
3. **PR body**: si el body cita un SHA (regex igual), ese SHA
   también debe pertenecer al set. La verificación acepta tanto el
   HEAD como cualquier commit intermedio que tenga check-runnable
   verde.
4. **Run ID opcional**: si la cita menciona un `runs/<id>`, se
   cruza con `GET /repos/{owner}/{repo}/actions/runs/{id}` y se
   exige que su `head_sha` también ∈ `green_sha_set`. Esto detecta
   el caso PR #612 donde el run citado era sobre `10e9c2a80`, no
   sobre el HEAD real.
5. **Falla cerrada**: si no se puede parsear la cita, o el SHA citado
   no está en el set, o el run citado no es del PR, el merge se
   bloquea con `::error` y un log estructurado en
   `paperclip/monitoring/pre-merge-waivers.log`.

### Implementación

- `paperclip/runtime/pre-merge-check.sh` añade una función
  `verify_sha_citation` que:
  1. Lista los commits del PR (`GET /pulls/{n}/commits`).
  2. Para cada commit, lista check-runs (`/commits/{sha}/check-runs`).
  3. Construye `green_sha_set`.
  4. Lee el último comentario sticky del job `devops-comment`
     (`GET /issues/{n}/comments` + filtro por autor bot + regex).
  5. Compara SHA citado contra el set.
- `ci.yml` añade un job `sha-citation-check` que corre antes de
  `devops-comment`, con `needs: [changes]`, idéntico patrón al
  gate actual. Si la cita no verifica → `exit 1` y aborta el
  workflow (no llega a publicar el comentario "CI verde").
- `qa.yml` añade un job equivalente (`sha-citation-qa-check`) que
  corre antes de `playwright-web` cuando el PR está siendo QA-eado,
  bloqueando el cómputo de un artefacto verde sobre un SHA
  falsamente citado.

### Waivers y excepciones

- El waiver ADR-0011 (`[SELF-APPROVED-EXCEPTION]`) sólo cubre la
  identidad compartida en la revisión humana; **no** exime de la
  Capa 3. Un self-approve con un SHA no verde sigue siendo
  fabricación.
- Si el PR está marcado como `draft`, la Capa 3 no aplica (no hay
  intención de merge). `pull_request` con `draft: true` se saltea.

### Alternativas descartadas

- **Manual gate humano** (CTO lee la cita y aprueba): rechazado.
  El caso PR #612 *fue* una aprobación humana que no detectó la
  discordancia. La verificación automatizada es estrictamente más
  barata que añadir un humano al loop, y no escala con la
  cadencia de merges del release train.
- **CI rule sobre el comentario fijo**: viable pero insuficiente.
  El comentario puede borrarse, editarse o re-publicarse. La Capa
  3 se ancla en la API del PR (commits + check-runs), no en el
  contenido del comentario, por lo que es resistente a
  manipulaciones del propio comentario.
- **Solo ADR, sin enforcement**: rechazado. ADR-0019 sin Capa 1+2
  en código fue insuficiente (PR #446, PR #612). El ADR solo se
  acepta si viene con la Capa 3 implementada en `pre-merge-check`.

## Consecuencias

- **Positivas**: el patrón de fabricación por squash con SHA
  desalineado deja de ser publicable. La cita en el comentario
  queda ligada a evidencia verificable (run + check-run sobre el
  mismo SHA).
- **Negativas / fricción**: el reviewer ya no puede citar "el
  último run verde" si hubo un push posterior — debe volver a
  citar el run del HEAD real. Esto añade ~30s por PR al flujo
  DevOps. Aceptable.
- **Operacional**: cada merge rechazado por Capa 3 deja huella en
  `pre-merge-waivers.log` con SHA citado, SHA real, run ID y
  motivo. Permite auditar patrones de fabrication flag en
  retrospectiva.

