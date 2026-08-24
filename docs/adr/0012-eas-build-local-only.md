# ADR-0012: EAS builds siempre con `--local`

- Estado: Aceptado
- Fecha: 2026-08-24
- Ticket: MGC-504
- Autor: devops (54bae0d0-d9e4-4736-b95f-76ebc8c6fdac)
- Decisor: Operador (CEO desiste de EAS cloud)

## Contexto

Entre 2026-08-23 y 2026-08-24 se mergearon tres PRs (ver tabla) que
introdujeron un workflow `deploy-ios-production.yml` basado en
`eas build --non-interactive` ejecutado en runners de EAS (cloud).

La idea era saltearse las restricciones de GH Actions hosted en el org
`mgcstudios` (MGC-305, billing suspendido) y aprovechar el runner cloud
de EAS como destino del build production iOS.

| PR  | SHA     | Contenido                                              |
|-----|---------|--------------------------------------------------------|
| #58 | 8651429 | workflow production build+submit via EAS cloud          |
| #59 | 5f18500 | agregar step `npm ci` antes de `eas build`             |
| #60 | 4534cac | cargar `EXPO_ASC_*` desde Infisical para build non-interactive |

## Decisión

**Operador 2026-08-24 corrige a CEO: NUNCA cloud build, SIEMPRE
`eas build --local`.**

- Eliminar `.github/workflows/deploy-ios-production.yml` del repo.
- Revertir las tres PRs #58, #59 y #60.
- Mantener PR #57 (sha `95219f5`, MGC-332): sólo toca `eas.json`
  (`ascAppId`, `appleTeamId`, `ascApiKeyPath`); es config local, no
  workflow.
- Builds production se ejecutan localmente desde el runner
  `copero-ci` (VPS `mgcstudios-01`) con:

  ```
  eas build --local --platform ios --profile production
  eas build --local --platform android --profile production
  ```

- Submits con `eas submit --platform <ios|android> --latest` (también
  local).
- Cualquier PR futura que agregue un workflow ejecutando builds en
  runners externos (EAS cloud, GH-hosted, MacStadium, etc.) será
  rechazada en review por esta ADR.

## Rationale

1. **Alineación con POLICIES.md §3 + §8.3 y plan MGC-294 (CTO)**:
   el plan del ticket padre ya dice *"Builds SIEMPRE con `--local`.
   No cloud runners."*
2. **Autosuficiencia del runner `copero-ci`**: el runner self-hosted
   en el VPS `mgcstudios-01` ya tiene instalado EAS CLI + Xcode +
   Android SDK; no necesitamos delegar a un servicio pago externo.
3. **Costo**: el plan EAS Production fue rechazado por CTO (MGC-299,
   2026-08-23). Mantenerse en free tier con builds locales evita
   upgrade innecesario.
4. **Auditoría**: las credenciales Apple (.p8) y Google
   (service-account.json) viven en Infisical `/mgcstudios/copero/store`
   y `/mgcstudios/appstore`; el runner las lee localmente, no viajan
   a servicios cloud de terceros.
5. **Tiempo**: `eas build --local` corre en hardware dedicado del
   VPS, comparable al cloud para nuestros volúmenes de release.

## Consecuencias

- **Positivas**:
  - Sin dependencia de facturación GH Actions o EAS Production.
  - Credenciales nunca salen del runner `copero-ci`.
  - Logs y artefactos viven en `~/Desktop/mgcstudios/copero/qa/builds/`
    del runner (ver MGC-406, MGC-501).
  - Debugging directo cuando un build falla (no hay capa cloud
    opaca entre DevOps y el comando).

- **Negativas / mitigaciones**:
  - El runner es single-tenant: si queda stuck (MGC-395, MGC-404,
    MGC-474), bloquea el pipeline. Mitigación: runbook
    `docs/runner-bootstrap.md` + monitor continuo en MGC-294.
  - Builds pesados (Android AAB release) pueden demorar 15-25 min;
    aceptable porque sólo corren en release, no en cada PR.

- **Reversibilidad**: alta. Eliminar el workflow es trivial; si
  en el futuro se revierte la directiva, alcanza con re-introducir el
  archivo en una rama nueva (ADR a actualizar).

## Ticket relacionado

- MGC-294 Publicación App Store + Play Store (parent, plan ya
  alineado con esta ADR)
- MGC-503 `npm ci` antes de `eas build` (revertido)
- MGC-504 este ticket (revertido + workflow eliminado)