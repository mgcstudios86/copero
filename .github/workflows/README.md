# Workflows — Copero

Convenciones operativas para los GitHub Actions de este repo. La política de
release-train vive en
[`mgcstudios/mgcstudios-paperclip` RFC-001](https://github.com/mgcstudios/mgcstudios-paperclip/blob/main/RFC-001-release-train.md);
este README solo documenta el layout propio de `.github/workflows/`.

## Runners self-hosted

ADR-0026 (MGC-2107) separa los runners en tres clases:

| Label | Runner físico | Workflows |
| --- | --- | --- |
| `copero-ci` | runner-01 (VPS mgcstudios-01, Linux) + runner-03 | `ci.yml` |
| `copero-qa` | runner-01 (VPS mgcstudios-01, Linux) | `qa.yml` |
| `copero-heavy` | runner-02 (Mac mini operador, macOS) | `eas.yml`, `release-internal.yml` |

Mapping detallado y reglas de "no compartir" en
[`AGENTS.md` §Runners](../../AGENTS.md#runners-self-hosted--mapping-label--runner--workflow).

## Inventario de workflows

| Archivo | Trigger principal | Runner | Función |
| --- | --- | --- | --- |
| `ci.yml` | PR + push a `main` y `release-*`, dispatch | `copero-ci` | Lint, typecheck, vitest, build web. Gate de merge. |
| `qa.yml` | PR + push a `main`/`release-*` con paths de UI, dispatch | `copero-qa` | Playwright headless contra bundle Expo web. |
| `eas.yml` | dispatch manual + PR etiquetados | `copero-heavy` | Builds EAS locales (Android APK/AAB, iOS sim). |
| `release-internal.yml` | dispatch manual | `copero-heavy` | Submit a track `internal` de Play Console. |
| `runner-watch.yml` | schedule + dispatch | n/a (actions api) | Vigila estado de runners self-hosted. |
| `runner-maintenance.yml` | dispatch | n/a (actions api) | Recovery canónico (playbook MGC-2273). |
| `purge-stuck-inprogress.yml` | schedule | n/a (actions api) | Cancela runs colgados. |
| `purge-stale-runs.yml` | schedule | n/a (actions api) | Limpia runs >30 días. |

## Reglas duras

1. **Builds EAS siempre `--local`** — nunca delegar a EAS Cloud. El runner se
   comparte con toda la flota MGC Studios.
2. **`copero-ci` no admite jobs >15min** — si la suite excede, va en
   `copero-qa` (Linux) o `copero-heavy` (macOS).
3. **Concurrencia con `cancel-in-progress`** — `ci.yml` y `qa.yml` lo usan
   para push/PR; `workflow_dispatch` usa grupo único (run_id / sha) para no
   cancelar runs en vuelo (MGC-2218).
4. **No crear nuevos labels de runner sin RFC** — `copero-ci`, `copero-qa`,
   `copero-heavy` cubren las tres clases conocidas.

## Añadir un workflow nuevo

1. Definir trigger (`on:`) y runner (`runs-on:`) con uno de los tres labels.
2. Si el job excede 15min de wall-clock, justificarlo en el comentario de
   cabecera y usar `copero-qa` o `copero-heavy`.
3. Si introduce un nuevo label de runner, abrir RFC en
   `mgcstudios/mgcstudios-paperclip` antes de mergear.
4. Actualizar este README en el mismo PR.
