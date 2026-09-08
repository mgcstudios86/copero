# Copero

This repo follows MGC Studios release-train workflow.

## Source of truth
- **Workflow policy**: [RFC-001](https://github.com/mgcstudios/mgcstudios-paperclip/blob/main/RFC-001-release-train.md) and [skill `MGC/release-train`](https://github.com/mgcstudios/mgcstudios-paperclip/blob/main/skills/company/MGC/release-train/SKILL.md).
- **Operational config** (Infisical, env vars, deployment): [PROJECT.md](https://github.com/mgcstudios/mgcstudios-paperclip/blob/main/projects/copero/PROJECT.md).
- Sync: `./setup.sh -o paperclip import`.

DO NOT redefine the release-train policy here. Branch decisions, freeze criteria, and cut rules live in the skill. Any deviation goes through an RFC update.

## Project-specific context
- App móvil **React Native + Expo**. Football-manager game. Cliente-only.
- Estado del juego en AsyncStorage (no backend persistente).
- Web companion (`copero-web/`) para iteración rápida de UI.

## Quick commands
\`\`\`bash
pnpm install
pnpm expo prebuild
pnpm eas build --local  # SIEMPRE --local (regla MGC Studios)
\`\`\`

## Estado actual del ciclo release-train
Ciclo release-3 activo. Ver meta-ticket `[Release status: release-3]` en el board Paperclip.

## Runners self-hosted — mapping label → runner → workflow

ADR-0026 (MGC-2107) reserva los runners self-hosted por clase de trabajo para
evitar que suites largas (Playwright 1h, EAS preview 40min) acaparen el pool
del gate de merge.

| Label (GitHub runner) | Runner físico | Workflows | Función |
| --- | --- | --- | --- |
| `copero-ci` | runner-01 (VPS mgcstudios-01, Linux) + runner-03 (Linux provision) | `ci.yml` | Gate de merge: lint, typecheck, vitest, build web. |
| `copero-qa` | runner-01 (VPS mgcstudios-01, Linux) | `qa.yml` | Playwright headless contra bundle Expo web. Independiente de `copero-ci` para que 1h de specs no bloquee el gate. |
| `copero-heavy` | runner-02 (Mac mini del operador, macOS) | `eas.yml` (preview AAB/APK, submit internal) | Builds EAS largas (Android ~40min, iOS similar). |

Reglas:
- **No migrar `qa.yml` a `copero-heavy`**: la decisión es mantener `copero-qa`
  como pool dedicado (decisión CEO 2026-09-08 20:00Z, ver MGC-2107 comments).
- **No compartir `copero-ci` con jobs largos**: si una suite excede 15min,
  va en `copero-qa` (Linux) o `copero-heavy` (macOS), nunca en `copero-ci`.
- **Nuevos workflows**: declarar `runs-on` con uno de los tres labels. Si
  hace falta un cuarto (ej. `copero-docs` para jobs de documentación), abrir
  RFC en `mgcstudios/mgcstudios-paperclip` antes de crear el label en GitHub.
