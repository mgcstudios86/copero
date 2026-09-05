# Runner bootstrap — Copero CI

Tres runners self-hosted atienden los workflows `ci (copero)`, `qa` y releases:

| Runner | Host | OS | vCPU | RAM | Label |
|---|---|---|---|---|---|
| `copero-ci-runner-01` | `146.235.246.167` (Oracle Cloud VPS) | Ubuntu 24.04 x86_64 | 2 | 1 GB | `self-hosted,Linux,X64,copero-ci,copero-qa` |
| `copero-ci-runner-02` | `192.168.68.71` (Mac mini local M4) | macOS 26 ARM64 | 8 | 16 GB | `self-hosted,copero-ci,macOS,ARM64` |
| `mac-mini-pipeline-runner` | `192.168.68.71` (Mac mini local M4) | macOS 26 ARM64 | 8 | 16 GB | `self-hosted,macOS,ARM64` |

Runner-01 (VPS) tiene 1 GB RAM — `npm ci` para RN+Expo tarda ~25 min y el
job `build web` falla por OOM tras 13 min. Los runners del Mac mini (M4,
16 GB) corren `npm ci` en **~4 s** y completan `build web` en **~30 s**.

## Registro de un nuevo runner

1. Solicitar token al repo:
   ```bash
   TOKEN=$(gh api -X POST /repos/mgcstudios/copero/actions/runners/registration-token \
     | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
   ```
2. Descargar binarios ARM64 (o x64 según host):
   ```bash
   mkdir -p ~/actions-runner-copero-XX && cd ~/actions-runner-copero-XX
   curl -sSfL -o runner.tar.gz \
     https://github.com/actions/runner/releases/download/v2.336.0/actions-runner-osx-arm64-2.336.0.tar.gz
   tar -xzf runner.tar.gz && rm runner.tar.gz
   ```
3. Configurar:
   ```bash
   ./config.sh --url https://github.com/mgcstudios/copero \
     --token "$TOKEN" --name copero-ci-runner-XX \
     --labels copero-ci --work _work --runnergroup default --unattended
   ```
4. Instalar como servicio launchd (auto-arranca en boot):
   ```bash
   ./svc.sh install $(whoami)
   ./svc.sh start
   ```
5. Verificar:
   ```bash
   gh api /repos/mgcstudios/copero/actions/runners | jq '.runners[] | {name,status,busy,os}'
   ```

## Secretos (Infisical)

Los workflows leen `INFISICAL_TOKEN` (secret) y `INFISICAL_PROJECT_ID`
(variable) desde GitHub Secrets. El token es PAT del operador con scope
`org:read` sobre el proyecto Infisical `/copero`. Rotar el PAT cada 90 d.

## Estado actual (2026-08-23)

- Runner-01 (VPS): estable; usado como fallback cuando el Mac está apagado.
- Runner-02 (Mac mini): registrado en MGC-329; reduce `npm ci` 25 min → 4 s
  y desbloquea paralelismo entre jobs de `ci (copero)`.
- `mac-mini-pipeline-runner`: pre-existente, etiqueta genérica.

## Migración Playwright a runner dedicado (MGC-1880)

El job `Playwright (web, headless)` del workflow `qa.yml` corre en
`runs-on: [self-hosted, copero-qa, Linux]`. La label `copero-qa` está
registrada en `copero-ci-runner-01` y separa las suites largas del pool
`copero-ci`, usado por CI y releases en el runner-02 macOS.

- **Runner destino**: `copero-ci-runner-01` (VPS, labels `copero-qa` y `Linux`).
  Si está ocupado, QA queda en su propia cola y no bloquea checks de CI.
- **Bootstrap Playwright** en el runner (sin `--with-deps`):
  ```bash
  sudo apt-get update && sudo apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libxcomposite1 libxdamage1 \
    libxrandr2 libxkbcommon0 libpango-1.0-0 libcairo2 libasound2 libgbm1
  npx --yes playwright@1.49.0 install chromium
  ```
- **Trampa OOM**: en VPS de 1 GB, `npx playwright install --with-deps`
  dispara apt que descarga ~600 MB y puede OOM-kill el runner. Usar
  `apt-get install` con paquetes individuales arriba y dejar que
  Playwright solo baje el binario Chromium (~170 MB).
- **Script faltante**: el job llama `npm run test:e2e:web`. Si
  `package.json` no lo define, falla con `Missing script`. El script debe
  ser:
  ```json
  "test:e2e:web": "playwright test --config=e2e/playwright.config.ts"
  ```
  Además `@playwright/test ^1.49.0` debe estar en `devDependencies` para
  que `npm ci --include=dev` lo instale. Verificado en MGC-308.

## Bootstrap Playwright en macOS ARM64 (MGC-346 + MGC-351)

`copero-ci-runner-02` es un Mac mini M4 (16 GB, macOS 26 ARM64). MGC-1880
reservó este runner para `ci (copero)` y releases; QA usa el label dedicado
`copero-qa` en el runner Linux.

- **Chromium binario**: NO requiere bootstrap manual. El job corre
  `npx playwright install chromium` y baja el binario ARM64 nativo a
  `~/Library/Caches/ms-playwright/`. En los runs observados
  (run 33296847880, SHA `72af9b3` de PR #162) la instalación completa en
  ~3 s sin warnings.
- **Sin `--with-deps`**: en macOS las system libs (libnss, libatk,
  libxcomposite, etc.) son nativas de Chromium y NO requieren apt. NO
  correr `playwright install --with-deps` en macOS (equivale a un
  `brew install` implícito que rompe la idempotencia del runner).
- **Verificación reproducible** desde shell del runner:
  ```bash
  # 1. Verificar que el binario se instaló y es ejecutable ARM64.
  ls -la ~/Library/Caches/ms-playwright/chromium-*/chrome-mac/chrome
  file ~/Library/Caches/ms-playwright/chromium-*/chrome-mac/chrome \
    | grep -q "arm64" && echo OK

  # 2. Smoke test (lanza Chromium, navega data: URL, cierra).
  node -e "
    const { chromium } = require('@playwright/test');
    (async () => {
      const b = await chromium.launch();
      const p = await b.newPage();
      await p.goto('data:text/html,<h1>ok</h1>');
      console.log('title=', await p.title());
      await b.close();
    })().catch(e => { console.error(e); process.exit(1); });
  "
  ```
- **Trampa conocida**: en macOS el primer `npx playwright install` puede
  fallar con `cannot find Chromium` si el binario se descargó bajo
  Rosetta (x86_64). Verificar con `file` que el binario es `arm64`. Si
  aparece x86_64, forzar reinstalación con:
  ```bash
  npx playwright install --force chromium
  ```
- **Verificado en MGC-351** (run 33296847880, SHA `72af9b3` de PR #162):
  el log de `Install Playwright Chromium` muestra assets/font/woff2
  descargados sin errores, y la suite Playwright llegó a ejecutar los
  specs (no falló por missing binary). Los 17 specs FAIL son por
  `waitForURL('**/simulador-carrera/identity')` que timeout — la causa
  raíz es routing de `btn-career` en el branch base (MGC-326), NO
  Chromium bootstrap.

## Verificación de billing cero

Tras mergear el cambio de `runs-on`, confirmar en
`https://github.com/organizations/mgcstudios/settings/billing` que los
minutos consumidos del mes no incrementan al disparar el workflow.
Cualquier minuto nuevo en GH-hosted tras un run `qa.yml` = regresión.
