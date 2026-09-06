# Copero — Agent Context

> **Source of truth — operational config**: la config operacional
> (secrets Infisical, env vars, deployment, runtime, build) vive en
> [`mgcstudios-paperclip/projects/copero/PROJECT.md`](https://github.com/mgcstudios/mgcstudios-paperclip/blob/main/projects/copero/PROJECT.md).
> Sync vía `./setup.sh -o paperclip import`.
>
> **Source of truth — workflow cross-project**:
> [`mgcstudios-paperclip/RFC-*.md`](https://github.com/mgcstudios/mgcstudios-paperclip/tree/main) y
> [`mgcstudios-paperclip/skills/company/MGC/`](https://github.com/mgcstudios/mgcstudios-paperclip/tree/main/skills/company/MGC).

## Domain

- App móvil **React Native + Expo**. Football-manager game. Cliente-only.
- Estado del juego en AsyncStorage (no backend persistente).
- 5 pantallas: identidad → draft → draft-complete → club → temporada.
- Web companion (`copero-web/`) para iteración rápida de UI.

## Build

```bash
pnpm install
pnpm expo prebuild
pnpm eas build --local  # SIEMPRE --local (regla MGC Studios)
```

## Conventions

- **Branch policy (RFC-001)**: PRs targetean `release-N`, no `main` directo.
  Hotfix path es la única excepción (`hotfix/<scope>` directo a `main`).
- **Release train**: ver meta-ticket `MGC-2020 [Release status: release-1]` en el board.
- **Test E2E**: Maestro flows en `maestro/flows/` (ver skill `mgc-maestro-e2e`).
- **BundleId**: `com.mgcstudios.copero`.
- **Expo owner**: `mgcstudios` · **slug**: `copero`.

## Workflow de release

1. Dev crea `feat/<scope>` desde `release-N` HEAD.
2. PR a `release-N` (no main).
3. code-reviewer aprueba → merge automático.
4. release-manager monitorea PRs y decide FREEZE.
5. Al freeze, **un solo** `[regression-release-N]` para QA, no per-PR.

## Historial

- 2026-09-01: backlog grinder activo (cientos de tickets cíclicos).
- 2026-09-04: consolidación en **MGC-1194** + **MGC-1195** + rol `release-manager`.
- 2026-09-05: primer cycle release-1 cerrado en 57min (3 PRs, 1 QA run).
- 2026-09-05: AGENTS.md creado con formato híbrido (PROJECT.md = config operacional, AGENTS.md = contexto del código).
