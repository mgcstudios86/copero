# ADR-0027 — Playwright runner: arquitectura híbrida macOS (inmediato) + Linux dedicado (mediano plazo)

- **Status**: accepted
- **Date**: 2026-09-11
- **Deciders**: CTO (f525acc4), devops (1626fb36)
- **Supersedes**: ninguno (refuerza ADR-0026)
- **Related**: MGC-2926 (cleanup runner-01), MGC-2927 (este ticket), MGC-1263 / MGC-1150 (CEO opción C para APK), MGC-2786 (954Mi patrón), MGC-2908 (runner-02 thrash), ADR-0026 (separación labels)

## Contexto

El host `mgcstudios-01` (VPS, 954 MiB RAM / 2 vCPU) hospeda dos
workloads: 16 contenedores de producción (relay, web, traefik, blossom,
redis, impostor, happy-scraper, etc.) **y** el GitHub Actions runner
`copero-ci-runner-01` (labels `copero-ci`, `copero-heavy`, `copero-qa`).
Playwright requiere >4 GB de RAM en Linux. Imposible fit. El devops aplicó
cleanup en MGC-2926 (`_diag` 347→57 MB, `.metadata_never_index`,
cancelación de run 34554979154 inminente OOM) y el resultado fue marginal:
290 MB disco, +60 MiB memory available. Insuficiente.

Diagnóstico host 2026-09-11 02:43Z: 666 MiB usados, 60 MiB free, swap 1.4
GiB thrash, load 8.49. La contención es estructural: subir RAM al VPS
mantiene la cohabitación `runner + 16 contenedores` y vuelve a saturarse
al siguiente deploy.

**Opciones evaluadas**:

| Opción | Costo | Latencia | Riesgo | Veredicto |
|---|---|---|---|---|
| **A. Upgrade VPS RAM** (Oracle reshape 4 GB) | ~$36/mes | 5-15 min reshape | Mantiene cohabitación runner+contenedores; próximo deploy satura de nuevo. No resuelve la causa raíz. | **Rechazada** |
| **B. Runner Linux dedicado Hetzner CX22** (4 GB / 2 vCPU) | €4/mes | 2-4 h provision + bootstrap | Host limpio, dedicado, label `copero-qa` exclusiva. | **Aceptada mediano plazo** |
| **C. Reusar `copero-ci-runner-02` macOS (16 GB ARM64)** | $0 | Inmediato (PR trivial a `qa.yml`) | Compite con gate de merge `copero-ci` (riesgo conocido y aceptado — ADR-0026 lo mitiga con `cancel-in-progress: true` y 60 min timeout). | **Aceptada inmediato** |

## Decisión

**Opción C inmediata + Opción B mediano plazo**. El patrón es idéntico a
la decisión CEO MGC-1150 / formalizada en MGC-1263 para builds Android:
"usar el runner macOS mientras se resuelve el estructural". En MGC-1263
fue `eas build --local` desde el Mac del mobile-developer. Aquí es
ejecutar el job `playwright-web` en `copero-ci-runner-02` (macOS 16 GB,
ya en el pool, sin costo incremental).

### Cambios concretos

**Inmediato (Opción C) — PR contra `main`**:

```diff
 # ADR-0026 (MGC-2466): QA es su propia clase `copero-qa`, servida por
-# runner-01 (VPS Linux) donde Playwright ya está bootstrapeado (MGC-1880).
-# NO usar `copero-ci` (gate de merge, runner-03) ni `copero-heavy`
-# (builds/releases, runner-02): una suite de 60 min no debe poder tomar
-# el runner del gate de merge.
-runs-on: [self-hosted, copero-qa]
+# runner-02 (macOS 16 GB) hasta que llegue el runner Linux dedicado
+# (ADR-0027, MGC-<provision>). Una suite de 60 min compite con el gate
+# de merge `copero-ci`; aceptamos la colisión temporal porque el gate
+# corre ~3 min y la suite es cancel-in-progress por PR actualizado.
+runs-on: [self-hosted, copero-ci, macOS]
```

**Justificación del label `copero-ci, macOS`**:

- `copero-ci-runner-02` (macOS ARM64, 16 GB) carga `copero-ci` por ADR-0026.
- Playwright headless sobre Chromium macOS funciona idéntico a Linux para
  nuestros specs web (validado MGC-1880 base + MGC-308 headless).
- La concurrencia `cancel-in-progress: true` (MGC-380) ya serializa suites
  largas; el conflicto con el gate es de minutos, no de horas.
- El bootstrap `bootstrap-copero-runner.sh` ya está aplicado a runner-02;
  no requiere reprovisionar.

**Mediano plazo (Opción B) — Hetzner CX22 €4/mes**:

- Provisionar `copero-ci-runner-03` (Hetzner CX22, 4 GB / 2 vCPU, Debian 12).
- Aplicar `bootstrap-copero-runner.sh` con label exclusiva `copero-qa`.
- Revertir `qa.yml` a `runs-on: [self-hosted, copero-qa]`.
- Trámite CEO: `MGC-2928-[aprobar-presupuesto-hetzner-cx22]` (escala CEO).
- Trigger: cuando el operador apruebe el budget, devops abre el ticket de
  provisioning con `blockedByIssueIds=[MGC-2928]`.

## Consecuencias

**Positivas**:
- PRs contra `main` y `release-*` recuperan gate Playwright hoy mismo.
- Cero costo inmediato. €4/mes a partir del día que el operador apruebe.
- runner-02 macOS sigue siendo el gate `copero-ci` para `ci.yml` (3 min);
  la competencia de Playwright es aceptable con `cancel-in-progress`.

**Negativas / riesgos**:
- Mientras Opción B no llegue, una suite de 60 min puede retrasar el
  gate de merge 3-5 min cuando ambos compitan. Aceptable porque la
  alternativa es no tener gate Playwright.
- runner-02 macOS puede tener thrash npm ci con specs pesados (MGC-2908);
  mitigación: el cleanup de MGC-2926 también lo aplica devops al runner-02
  (`_diag`, `.metadata_never_index`).
- El Hetzner CX22 introduce un host más a mantener (3 self-hosted runners
  totales). Justificado por la separación de concerns de ADR-0026.

## Reversibilidad

- Cambio `qa.yml` es revertible con un revert de PR. Sin migraciones de
  datos, sin pérdida de artefactos.
- Hetzner CX22: cancellable mes a mes. No hay lock-in.
- Si la suite Playwright sobre macOS muestra flakes por ABI/EOL de
  Chromium macOS, rollback a Opción A o esperar provisioning B.

## Out of scope

- Builds Android (sigue MGC-1263 — Mac local del mobile-developer).
- Builds iOS (sigue `eas.yml` → runner-02 macOS, inalterado).
- Migración del relay/web/redis/blossom a otro host (ticket aparte).
