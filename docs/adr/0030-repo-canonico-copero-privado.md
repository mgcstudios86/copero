# ADR-0030 — Repo canónico de Copero: `mgcstudios/copero` (privado)

- **Status**: accepted
- **Date**: 2026-09-17
- **Deciders**: CTO (`04f696a8`); mobile-developer (`dec5b0c2`) revisor operativo.
- **Context**: MGC-473 (desbloqueo MGC-463), MGC-434 (PR `mgcstudios/copero` #656, commit `bae0bd4`), MGC-246/MGC-386 (historial huérfano en `mgcstudios86/copero`).
- **Supersedes**: ninguno.
- **Related**: `engineering-workflow §1.2`, ADR-0011 (self-approve exception), ADR-0019 (guardrail CI rojo), ADR-0029 (anti-fabrication).

## Contexto

Copero tiene **dos repositorios paralelos** con la misma estructura de
carpetas (App.tsx, app/, assets/, components/, design/, engine/,
features/, screens/, etc.) pero historias e identidades distintas:

| Repo                              | Tipo     | Origen                          | Estado hoy |
|-----------------------------------|----------|---------------------------------|------------|
| `mgcstudios86/copero`             | público  | fork de `kiya0908/copero`       | espejo histórico, sin features activas |
| `mgcstudios/copero`               | privado  | repo propio de la compañía      | repo activo: design artifacts, EAS/CI, features en curso |

El **mobile-developer** opera con un workspace que clona
`mgcstudios86/copero` (origen `project_primary`), pero los artefactos
de diseño del diseñador (`docs/screens/restantes-impostor/*.html`,
`docs/handoffs/*.md`, CSS en `source/`) viven **solo** en
`mgcstudios/copero` PR #656 (commit `bae0bd4`, branch
`feat/design-restantes-impostor-base`, **OPEN, no mergeado**).

Esto bloqueó MGC-463: el implementador necesita leer HTML/CSS/handoffs
que no existen en el repo que su workspace clona. El bloqueante
arquitectural fue escalado al CTO vía MGC-473.

## Diagnóstico

Tres hechos verificables al 2026-09-17:

1. **El diseño vive solo en el privado.** `gh api
   repos/mgcstudios86/copero/contents/docs/screens` → 404. `gh api
   repos/mgcstudios/copero/contents/docs/screens` → contiene el
   directorio. El commit `bae0bd4` existe en privado y devuelve
   `HTTP 422 Not Found` en el público.
2. **El activo de la compañía vive en el privado.** Branches activas
   recientes: `feat/c3-admob-v2`, `chore/ios-production-deploy-workflow`,
   `feat/build-career-i18n`, `feat/multi-slot-save-r2-mgc2635`,
   `feat/post-match-mvp-injuries-labels`. Workflows `ci.yml`, `qa.yml`,
   `devops-comment` están anclados al privado.
3. **El público es un espejo congelado.** `mgcstudios86/copero`
   arrastra historia temprana (`feat/mgc-212-calendar-semanal`,
   `feat/mgc245-alineacion`, `feat/launch-readiness`) pero no recibe
   desarrollo activo desde MGC-246/MGC-386. Su rama por defecto
   `main` está divergente de la realidad del producto.

El workspace del mobile-developer fue configurado con la fuente
equivocada desde el inicio. MGC-463 es el primer ticket que choca
con esa configuración: depende de assets que el workspace no ve.

## Opciones evaluadas

### Opción A — Implementar en `mgcstudios86/copero`, copiando assets del privado

- **Pro**: cero migración, el workspace actual sigue funcionando.
- **Contra**:
  - **Drift permanente**: cada nuevo artefacto del diseñador requiere
    `git cp` manual desde el privado; el historial de diseño se
    bifurca del código que lo implementa.
  - **PR de sync obligatorio** por cada lote de assets — fricción
    permanente, riesgo de olvido, evidencia partida.
  - **CI/workflows divergentes**: `ci.yml`, `qa.yml`,
    `devops-comment` viven en el privado; el público no recibe los
    checks.
  - **Historial de revisiones roto**: los PRs hacia el público no
    tienen los gates §8.1 activados (DevOps comment + review + CI
    sobre el mismo SHA).
- **Veredicto**: **rechazada**. Resuelve un ticket, no la causa raíz.

### Opción B — Migrar código activo a `mgcstudios86/copero` (al público)

- **Pro**: alinea repo con el open-source que la compañía ya publicó.
- **Contra**:
  - **Rompe ADR-0011 / ADR-0019 / ADR-0029**: el guardrail contra
    self-merge con CI rojo y el anti-fabrication están implementados
    sobre `mgcstudios/copero`. Migrar al público requiere reescribir
    el guardrail y perder el historial de gates.
  - **Privacidad del código activo**: AdMob IDs, EAS tokens,
    Infisical paths, iOS production workflow — son material sensible.
    El público ya está libre de eso porque se congeló antes de
    meterlo.
  - **Pérdida de artefactos**: el diseñador trabaja sobre el privado;
    si el código migra al público, el diseñador debe publicar sus
    handoffs al público también, duplicando superficie.
- **Veredicto**: **rechazada**. Más riesgo operativo que beneficio.

### Opción C — Declarar `mgcstudios/copero` como repo canónico y reasignar workspaces

- **Pro**: cero migración de código, cero pérdida de artefactos,
  cero reescritura de guardrails. El workspace del
  mobile-developer se reconfigura (estrategia `github_repo`) para
  clonar el privado; el resto del flujo (PR → CI → review → merge)
  no cambia.
- **Contra**:
  - `mgcstudios86/copero` queda como histórico público, no se
    borra (decisión separada, fuera del scope de MGC-473).
  - El operador necesita acceso al privado en su máquina (si no lo
    tiene ya). El token actual (`gh auth status`) alcanza para el
    privado porque ya opera PRs en él.
- **Veredicto**: **aceptada**.

## Decisión

`mgcstudios/copero` (privado) es el **único repositorio canónico**
para el desarrollo activo de Copero. Toda nueva rama, PR, ADR, test,
workflow y artefacto de diseño se hace contra `mgcstudios/copero`.

`mgcstudios86/copero` se mantiene como espejo público congelado de
la historia MGC-246/MGC-386. No recibe desarrollo nuevo; no se mergea
nada desde él hacia el privado. La eventualidad de actualizarlo
(publicar un snapshot del privado) es **out of scope** y se
gestionará en un ticket aparte si surge la necesidad.

**Acciones inmediatas derivadas de esta decisión**:

1. **Mobile-developer**: el workspace del proyecto Copero cambia su
   estrategia de `project_primary` (que clonaba
   `mgcstudios86/copero`) a `github_repo` apuntando a
   `mgcstudios/copero`. Esto se materializa al cerrar MGC-473 con un
   ticket de follow-up contra el operador o el DevOps para ajustar
   `paperclip/projects/<projectId>/workspace.json` (o el setting
   equivalente del runtime de Paperclip). Mientras eso no ocurra,
   MGC-463 queda **bloqueado** con `blockedByIssueIds` hacia
   MGC-473 + un child nuevo `[configurar-workspace-copero-repo-privado]`.

2. **MGC-463**: al cerrar MGC-473, el mobile-developer hace checkout,
   refresca `blockedByIssueIds=[MGC-<NEW>-workspace]` y arranca por
   `feat/flow-temporada-loop` clonando el privado.

3. **Operador** (notificación): la decisión está documentada en este
   ADR; no requiere sign-off porque es reversible (volver a Opción A
   es trivial si la Opción C no funciona en producción).

## Consecuencias

**Positivas**:
- Diseño y código viven en el mismo repo: el implementador lee
  HTML/CSS/handoffs en el mismo clon donde commitea la
  implementación.
- CI, QA, DevOps comment y guardrails §8.1 / ADR-0019 / ADR-0029
  siguen funcionando sin cambios.
- Historial de PRs/reviews intacto.
- Una sola fuente de verdad para AdMob/EAS/Infisical.

**Negativas**:
- El workspace del mobile-developer necesita reconfiguración
  operativa antes de MGC-463 destrabe completamente.
- El público `mgcstudios86/copero` queda formalmente fuera del flujo
  activo (hay que recordarlo en nuevos tickets — este ADR es la
  referencia).
- Si la compañía decide abrir el código, la mecánica de publicación
  futura (snapshot del privado) es **fuera de scope** de este ADR.

## Riesgos y mitigaciones

- **Riesgo**: el operador no acepta mover el workspace del
  mobile-developer al privado. **Mitigación**: la decisión es
  técnica y reversible; si el operador prefiere una variante
  (fork del privado con permisos de lectura para el implementador),
  se reabre el ADR con la nueva opción.
- **Riesgo**: el privado queda inaccesible para un agente
  (token expirado, scopes faltantes). **Mitigación**: §1.4 del
  `engineering-workflow` cubre el orden scope → estado → rate limit
  antes de investigar toolchain.
