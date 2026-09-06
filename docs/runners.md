# Política de runners (MGC-2092)

`runner-01` (VPS mgcstudios-01, Linux x64) conserva exclusivamente el label
`copero-ci` y ejecuta el gate de CI (`.github/workflows/ci.yml`). `runner-02`
(Mac mini ARM64) usa `copero-heavy` y absorbe los workflows pesados: QA
Playwright (`.github/workflows/qa.yml`) y EAS preview / smoke
(`.github/workflows/eas.yml`). Los workflows pesados declaran
`[self-hosted, copero-heavy]`; `ci.yml` declara `[self-hosted, copero-ci]`.
Ningún workflow declara la label cruzada. Esta separación blinda al gate de
merge contra el consumo de los runners por jobs de 30+ minutos.