# Copero

Juego React Native (Expo) imitación de [copero.com.ar](https://copero.com.ar/). Toda la lógica corre en el cliente. Sin servidor.

> **Repo**: `github.com/mgcstudios/copero` (privado, org `mgcstudios`)
> **Estado**: bootstrap inicial (MGC-290). El código del juego llega en tickets siguientes.

---

## Estado del repo

| Área | Estado |
| --- | --- |
| Repo GitHub privado | ✅ creado |
| CI (`ci.yml`) | ✅ workflow configurado (lint + typecheck + test-web + build-web) |
| EAS preview (`eas.yml`) | ✅ workflow configurado (builds `--local` en feature branches) |
| Secrets wiring (Infisical) | ✅ documentado en este README |
| Branch protection | ⚠️ pendiente upgrade a GitHub Pro (workaround: gates en workflows) |

**Limitación conocida**: GitHub Free no permite `branch protection` ni `rulesets` en repos privados. La protección se enforce vía workflows (`ci.yml` requiere checks verdes antes de mergear) y disciplina del equipo (PR review manual). El CTO/DevOps puede activar branch protection formal cuando la org se migre a Pro.

---

## Setup local

### Requisitos

- macOS con Xcode (iOS) y Android Studio (Android) instalados
- Node 20+
- EAS CLI: `npm install -g eas-cli`
- Infisical CLI: `brew install infisical`
- Expo CLI: viene con las devDependencies del proyecto

### Variables de entorno

El proyecto usa [Infisical](https://infisical.com) para secretos. La estructura esperada:

```
/copero/
├── ads/        → AdMob App ID, Ad Unit IDs (banner + interstitial)
├── signing/    → EAS token, App Store API key (.p8), Play Store JSON key
└── deploy/     → GitHub PAT, webhook URLs
```

### Instalar y correr

```bash
# 1. Clonar
git clone https://github.com/mgcstudios/copero.git
cd copero

# 2. Instalar deps
npm ci --ignore-scripts

# 3. Login Infisical (una sola vez por máquina)
infisical login

# 4. Cargar secretos al ambiente dev → genera .env local
infisical export --projectId="$INFISICAL_PROJECT_ID" --env=dev --path=/copero --format=dotenv > .env

# 5. Iniciar Expo dev server
npx expo start
```

> **Tip**: el proyecto usa `app.config.js` que lee `.env` vía `dotenv`. NO commitear `.env` (está en `.gitignore`).

### Tests

```bash
# Unit (vitest, una sola pasada)
npx vitest run

# Watch mode
npx vitest
```

### Lint + typecheck

```bash
npm run lint     # eslint
npm run typecheck # tsc --noEmit
```

### Build web local

```bash
npx expo export --platform web --output-dir dist
# artefacto queda en dist/ — sirve con cualquier static server
```

### Build mobile (preview)

```bash
# Android (Play internal track)
eas build --local --platform android --profile preview

# iOS (TestFlight)
eas build --local --platform ios --profile preview
```

---

## CI/CD

### `ci.yml` — corre en `push` y `PR` contra `main`

| Job | Qué hace | Filtro de paths |
| --- | --- | --- |
| `lint` | `eslint --max-warnings=0` | `src/**`, `app/**`, `*.{ts,tsx}` |
| `typecheck` | `tsc --noEmit` | `*.ts`, `*.tsx`, `tsconfig*.json` |
| `test-web` | `vitest run` | `**/*.test.{ts,tsx}`, `**/*.spec.{ts,tsx}` |
| `build-web` | `expo export --platform web` (publica artefacto `copero-web-build`) | `App.tsx`, `app.json`, `package.json` |
| `devops-comment` | Sticky comment en PR con resultado de cada job (gate §8.1) | siempre en PRs |

Política: **builds `--local`**, runner `self-hosted` (Mac mini del operador). El CI no compila binarios mobile — sólo web + checks estáticos.

### `eas.yml` — corre en push a feature branches

| Trigger | Plataformas |
| --- | --- |
| `feat/**`, `fix/**`, `chore/**`, etc. | Android + iOS (preview profile, `--local`) |

Filtro `paths-filter`: si sólo cambian paths de Android → solo Android; iOS → solo iOS; core (`App.tsx`, `src/**`) → ambas.

### Workflow futuro: `deploy.yml`

Queda fuera de este bootstrap. Se agrega cuando llegue el primer release a `main`. Patrón de referencia: [`mgcstudios/anotador-universal/.github/workflows/deploy.yml`](https://github.com/mgcstudios/anotador-universal/blob/main/.github/workflows/deploy.yml).

---

## Secrets — Infisical ↔ GitHub Actions

### Cómo funciona

1. **GitHub Actions recibe** los secretos directamente de Infisical vía `infisical export` en cada job que los necesite.
2. El runner tiene `INFISICAL_TOKEN` configurado como GitHub Secret (ver tabla abajo).
3. `INFISICAL_PROJECT_ID` también es GitHub Secret.
4. Cada workflow declara qué paths necesita (`--path=/copero/ads`, `--path=/copero/signing`, etc.) y de qué env (`dev`, `preview`, `prod`).

### Secrets requeridos en GitHub (repo `mgcstudios/copero`)

| Secret | Para qué se usa | Quién lo rota |
| --- | --- | --- |
| `INFISICAL_TOKEN` | Autentica el `infisical export` en cada job | DevOps (via Infisical service token scoped a `/copero`) |
| `INFISICAL_PROJECT_ID` | Workspace ID de Infisical donde vive `/copero` | DevOps (fijo, no rotar) |
| `EXPO_TOKEN` | `eas build --local` / `eas submit` (PAT de Expo) | DevOps (rotar cada 90 días o cuando se vaya) |
| `DEV_BOT_TOKEN` | Sticky comment en PRs (`gh pr comment` via `marocchino/sticky-pull-request-comment`) | DevOps (PAT de `mgcstudios86` con scope `repo`) |

> **Nunca** commitear tokens ni en `.env` trackeado ni en comentarios de PR. Consumir siempre desde GitHub Secrets → Infisical.

### Cómo agregar un nuevo secret

1. **En Infisical** (UI web o CLI), crear el secret bajo el path correcto:
   ```bash
   # Ejemplo: agregar AdMob App ID de Android al path /copero/ads en env preview
   infisical secrets set ADMOB_ANDROID_APP_ID="ca-app-pub-XXXX~YYYY" \
     --projectId="$INFISICAL_PROJECT_ID" \
     --env=preview \
     --path=/copero/ads
   ```
2. **En el código**, leerlo vía `process.env.ADMOB_ANDROID_APP_ID` (si se expone al runtime) o inyectarlo en `app.config.js` (Expo SDK 49+ soporta `extra`).
3. **En el workflow**, si el secret nuevo es **sólo de runtime móvil**, no requiere cambios — `infisical export --path=/copero` ya lo trae.
4. Si necesitás un secret de **CI-level** (ej: clave de API de Sentry), exponerlo como GitHub Secret **Y** sincronizarlo a Infisical. Razón: tener doble fuente evita que un secret de CI se rompa si Infisical cae.

### Rotación

- Tokens de servicio (`INFISICAL_TOKEN`, `EXPO_TOKEN`): rotar cada 90 días. DevOps abre ticket `[MGC-N]-[rotar-Infisical-copero]` y sigue el runbook estándar de rotación.
- Service account Infisical: scope debe limitarse a `/copero/**`. NO usar el token root de la org.
- Auditoría: DevOps verifica trimestralmente que cada secret de GitHub esté mapeado a un secret de Infisical con scope correcto.

---

## Estructura del repo

```
copero/
├── .github/workflows/
│   ├── ci.yml           ← lint + typecheck + test-web + build-web + devops-comment
│   └── eas.yml          ← preview builds --local para feature branches
├── .gitignore
├── README.md
├── app/                 ← Expo Router routes (por crear)
├── src/                 ← Lógica de juego, hooks, utils (por crear)
├── App.tsx              ← Entry point (por crear)
├── app.json             ← Expo config (por crear)
├── eas.json             ← EAS Build profiles (por crear)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .eslintrc.cjs
```

> Esta es la **estructura objetivo**. El código del juego se agrega en tickets posteriores (mobile-developer).

---

## Tickets activos

- **MGC-286** — Copero (parent, in_progress)
- **MGC-287** — Crear carpeta Infisical `/copero` con subcarpetas (en curso por security)
- **MGC-290** — Este bootstrap (DevOps)

---

## Política de builds (recordatorio)

Todos los jobs de CI y todos los comandos de release-build usan `--local`. **Nunca** `eas build` sin `--local` ni runners cloud para compilar binarios. Ver `POLICIES.md §8.3` y `engineering-workflow` SKILL §8.3.

Si una PR introduce `--nonlocal` o `runs-on: github-hosted` para compilar binarios → rechazar en review con:

> "MGC Studios solo construye local — el runner se comparte entre la flota."
