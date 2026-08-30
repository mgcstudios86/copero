# Copero — guía para agentes Claude

App Expo (iOS/Android/web) del repo `mgcstudios/copero`. Esta guía aplica solo dentro de este proyecto.

## Regla dura: CI corre en runner self-hosted

**Todos los jobs de GitHub Actions en este repo deben usar `runs-on: [self-hosted, copero-ci]`** (la label `copero-ci` resuelve tanto al runner Linux del VPS `mgcstudios-01` como al runner macOS ARM64 del Mac mini local). Nunca usar `runs-on: self-hosted` pelado, ni `ubuntu-latest`, ni otro hosted de GitHub.

La label histórica `Linux` puede mantenerse en workflows existentes como documentada en MGC-308 (limita a runner Linux VPS) — pero **NO** debe agregarse en nuevos workflows ni en jobs que deben correr en el pool mixto (ej. `qa.yml` Playwright, donde macOS ARM64 reduce `npm ci` de 25min a 4s y `build web` de OOM a 30s).

Razón: el org `mgcstudios` tiene la facturación de GH Actions suspendida por falta de pago (MGC-305). Cualquier minuto en runner hosted falla con *"recent account payments have failed or your spending limit needs to be increased"* y bloquea el job completo. Referencia: MGC-308 migró Playwright a self-hosted; MGC-346 amplió el pool a macOS ARM64; MGC-379 migró `eas-preview` a runner con label `copero-ci`.

**Aplica a todos los workflows**: `ci.yml`, `qa.yml`, `eas.yml`, `purge-stale-runs.yml`. Cualquier PR que use `runs-on: self-hosted` sin la label `copero-ci` será rechazada en review (§8.3 + §1.4 de `engineering-workflow`).

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

## Tickets de referencia

- MGC-286 — track padre del proyecto.
- MGC-302 — scaffold Playwright.
- MGC-305 — billing GH Actions (resolución pendiente del operador).
- MGC-308 — migración a runner self-hosted (MERGED).
- MGC-359 — fix cache `setup-node` (MERGED).
- MGC-379 — eas-preview a runner copero-ci + EXPO_TOKEN via Infisical.
