# Política de runners

> **Superseded por ADR-0026** (MGC-2466). La política de dos clases descrita
> abajo quedó obsoleta: `copero-ci` y `copero-heavy` terminaron declaradas en
> **ambos** runners, así que un job de QA de 60 min podía tomar el runner del
> gate de merge (MGC-2226: 24 min de cola contra 68 s de compute).
>
> Estado vigente:
> - **Política**: `docs/adr/0026-separacion-runners-ci-qa-heavy.md` — tres
>   clases (`copero-ci` / `copero-qa` / `copero-heavy`), una por runner.
> - **Inventario y matriz de labels**: `docs/runner-inventory.md`.
> - **Bootstrap**: `docs/runner-bootstrap.md`.

## Política previa (MGC-2092, histórica)

`runner-01` (VPS mgcstudios-01, Linux x64) conserva exclusivamente el label
`copero-ci` y ejecuta el gate de CI (`.github/workflows/ci.yml`). `runner-02`
(Mac mini ARM64) usa `copero-heavy` y absorbe los workflows pesados: QA
Playwright (`.github/workflows/qa.yml`) y EAS preview / smoke
(`.github/workflows/eas.yml`). Los workflows pesados declaran
`[self-hosted, copero-heavy]`; `ci.yml` declara `[self-hosted, copero-ci]`.
Ningún workflow declara la label cruzada. Esta separación blinda al gate de
merge contra el consumo de los runners por jobs de 30+ minutos.