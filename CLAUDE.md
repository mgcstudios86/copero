# Copero — guía para agentes Claude

App Expo (iOS/Android/web) del repo `mgcstudios/copero`. Esta guía aplica solo dentro de este proyecto.

## Regla dura: CI corre en runner self-hosted

**Los jobs de CI y release usan `runs-on: [self-hosted, copero-ci]`**. CI y tareas cortas agregan `macOS` para usar el runner-02 y no competir con Playwright. QA usa `runs-on: [self-hosted, copero-qa, Linux]` en el runner-01 dedicado. Nunca usar `runs-on: self-hosted` pelado, ni `ubuntu-latest`, ni otro hosted de GitHub.

La label histórica `Linux` limita jobs al runner Linux VPS. La label `copero-qa` se reserva para Playwright y evita que sus suites largas compitan con CI/release en `copero-ci`.

Razón: el org `mgcstudios` tiene la facturación de GH Actions suspendida por falta de pago (MGC-305). Cualquier minuto en runner hosted falla con *"recent account payments have failed or your spending limit needs to be increased"* y bloquea el job completo. Referencia: MGC-308 migró Playwright a self-hosted; MGC-346 amplió el pool a macOS ARM64; MGC-379 migró `eas-preview` a runner con label `copero-ci`; MGC-1880 aisló QA en `copero-qa`.

**Aplica a todos los workflows**: `ci.yml`, `qa.yml`, `eas.yml`, `purge-stale-runs.yml`. Toda nueva job debe usar labels self-hosted explícitas y respetar la separación `copero-qa`/`copero-ci`.

## Convenciones del runner

- Label requerida: `copero-ci` (la instancia vive en el VPS `mgcstudios-01`).
- Sin `cache: 'npm'` en `actions/setup-node@v4` (MGC-359): sube ~800MB al cache GH-hosted y bloquea el runner hasta timeout. Omitir el input `cache`.
- Sin `--with-deps` en `npx playwright install chromium`: los apt packages se instalan vía `bootstrap-copero-runner.sh`.
- Workflows: `ci.yml` (lint/typecheck/test/build-web), `qa.yml` (Playwright web), `eas.yml` (Expo build).
- Secretos: leerlos vía Infisical, nunca hardcodear ni usar `${{ secrets.* }}` cuando Infisical los puede servir. `.env.example` documenta la estructura.
- **EXPO_TOKEN** específicamente: `eas.yml` lo carga con `infisical export --env=prod --path=/copero` y lo exporta a `$GITHUB_ENV`. **No** leerlo de `${{ secrets.EXPO_TOKEN }}` (MGC-379).

## Stack y comandos

- TypeScript, Expo SDK, Jest (unit), Playwright (E2E web).
- Scripts clave: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build:web`, `npm run test:e2e:web`.
- Branch policy: PRs contra `main` con `gh pr create --base main`. Squash merge. Ramas `tipo/descripcion-corta`.

## Estructura

- `app/`, `src/` — código de la app Expo.
- `e2e/` — tests Playwright (web bundle).
- `design/` — sistema visual (arquetipos, tokens).
- `docs/` — `runner-bootstrap.md` para aprovisionar nuevos runners.

## Política de APK QA (MGC-1263 — opción C CEO MGC-1150)

**El APK de QA sale de `eas build --local` ejecutado en el Mac por mobile-developer**, NO del CI. `.github/workflows/eas.yml` quedó reducido a smoke (lint + typecheck + config validate) para Android; el único job que aún produce artefacto es `preview-ios` sobre el runner-02 macOS.

Razón: el runner-01 (VPS `mgcstudios-01`, 954 MB / 2 vCPU) no sostiene builds Android. 30 runs históricos = 0 success / 26 cancelled por supersede. Cualquier intento de `eas build` sobre Linux queda en starvation y bloquea el resto del pool `copero-ci`.

**Flujo canónico (mobile-developer → QA):**

1. Mobile-developer commitea el fix y abre PR contra `main`.
2. CI verde en el SHA del merge (gate §8.1 `engineering-workflow`).
3. Mobile-developer ejecuta local en su Mac:

   ```bash
   eas build --local --platform android --profile preview --non-interactive \
     --output ~/Desktop/mgcstudios/impostor/qa/builds/build-<PR>-<versionCode>-<shortSHA>.apk
   ```

   SHA pineado al commit que se va a mergear. **No** se rebuilda contra `main` post-merge (la fuente de verdad es el commit del PR).
4. Mobile-developer crea ticket `MGC-{NUEVO}-[ejecutar-QA-PR-{N}]` asignado a QA con path absoluto del APK.
5. QA corre Maestro sobre ese APK (ver `qa/AGENTS.md`).

**Lo que el CI hace (y NO hace) por Android:**

- ✅ Detecta paths Android, corre `npm ci`, valida `eas.json` (perfiles `preview`/`preview-ios-sim`/`production`, `cli.appVersionSource: remote`), valida `app.config.js` (`extra.eas.projectId`, `android.package`, `ios.bundleIdentifier`), corre `npm run lint`, corre `npm run typecheck`.
- ❌ NO corre `eas build --local --platform android`.
- ❌ NO publica APK como artifact.
- ❌ NO corre `provenance-check.mjs` (provenance requería el APK).
- ❌ NO corre `qa-ac7-force-stop` (gate Maestro sobre device físico, depende del APK).

**Defensa en profundidad:** el job `smoke-android` grepea `eas build` en `.github/workflows/eas.yml` y falla el job si alguien lo reintroduce. Si alguien necesita legítimamente un build Android en CI, debe pasar por la mesa de presupuesto (CEO + CTO).

**Fuera de alcance (pendiente operador):** escalar el VPS a ≥8 GB / 4 vCPU (opción A) o agregar un segundo runner Linux (opción B). Hasta entonces, el patrón Mac local es la fuente única de APK.

## Tickets de referencia

- MGC-286 — track padre del proyecto.
- MGC-302 — scaffold Playwright.
- MGC-305 — billing GH Actions (resolución pendiente del operador).
- MGC-308 — migración a runner self-hosted (MERGED).
- MGC-359 — fix cache `setup-node` (MERGED).
- MGC-379 — eas-preview a runner copero-ci + EXPO_TOKEN via Infisical.
- MGC-1132 — runner-01 starvation iOS→macOS (PR #296 f19052c MERGED).
- MGC-1150 — decisión CEO: opción C APK = Mac local.
- MGC-1206 — provenance gate (RETIRADO por MGC-1263, requería APK).
- MGC-1263 — formalización APK local Mac + eas.yml como smoke.
