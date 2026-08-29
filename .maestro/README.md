# Maestro flows

Flujos E2E mobile para Copero. Se ejecutan **en el device físico del
QA agent** (ZY22G728HN), no en CI. El workflow `qa.yml` solo corre
Playwright web; Maestro mobile queda fuera por costo de hardware.

## Convenciones
- Un flow por AC (`<feature>-<caso>.yaml`).
- `appId: com.mgcstudios.copero` (Expo Android).
- IDs de `testID` de RN; textos visibles en español para `assertVisible`.
- Cada flow declara `tags` con los IDs MGC que cubre.

## Flows
- `club-ambicion.yaml` — AC MGC-217 + MGC-221: tap "Firmar con Boca Juniors"
  verifica arquetipo AMBICIÓN y navegación a `/simulador-carrera/temporada`.

## Cómo correr
```bash
maestro test .maestro/club-ambicion.yaml
```

APK esperado: `build-138-preview-6422e8e.apk` (instalado manualmente por QA).
