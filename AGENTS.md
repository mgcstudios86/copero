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
