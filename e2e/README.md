# E2E — Copero

Infraestructura E2E base. **MGC-302**. Cobertura funcional completa en MGC-293.

## Layout

| Path | Scope | Stack |
|---|---|---|
| `e2e/playwright.config.ts` | Web (Chromium) | Playwright |
| `e2e/home.spec.ts` | Smoke home | Playwright |
| `e2e/mobile/home.yaml` | Home (Expo Go) | Maestro |
| `e2e/fixtures/noop.tsx` | Mocks ads | Shared |
| `.github/workflows/qa.yml` | CI workflow | GitHub Actions |

## Comandos

```bash
# Web (Playwright). Levanta Expo web dev en :8081 si no está corriendo.
npm run test:e2e:web

# Mobile (Maestro). Requiere Expo Go + emulador booted (qa agent owns ZY22G728HN).
npm run test:e2e:mobile

# Build web estático (lo que CI sirve con http-server).
npm run build:web
```

## Variables de entorno

| Var | Default | Uso |
|---|---|---|
| `EXPO_WEB_BASE_URL` | `http://localhost:8081` | baseURL Playwright |
| `INFISICAL_*` | — | Secretos runtime (CI los inyecta) |

## CI

Workflow `qa.yml` corre Playwright headless contra el bundle `dist/` generado por `npm run build:web`. Maestro se ejecuta **solo** sobre hardware persistente (no en CI por ahora — ver MGC-293).

## Reglas

- **No correr en paralelo**: `workers: 1`, `fullyParallel: false`. El QA agent
  itera secuencialmente sobre el device físico (`ZY22G728HN`) para no pisar
  estado entre runs.
- **No tocar `ci.yml`**: este PR solo agrega `qa.yml`.
- **No incluir secretos**: placeholders `INFISICAL_*`; DevOps inyecta valores.
