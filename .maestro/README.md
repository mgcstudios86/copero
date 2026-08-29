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
- `club-ambicion.yaml` — AC MGC-217 + MGC-221 + MGC-223: tap "Firmar con Boca Juniors"
  verifica arquetipo AMBICIÓN y navegación a `/simulador-carrera/temporada`.

## Precondiciones de entorno

Maestro mobile **no** funciona sin estas piezas configuradas en el host
del QA agent. Sin esto, los flows fallan con errores crípticos que no
apuntan a la causa real.

### 1. JAVA_HOME

Maestro no resuelve el `java` del PATH del sistema en macOS. Hay que
exportar `JAVA_HOME` apuntando a openjdk@17 antes de correr cualquier
flow:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
```

Verificar con `[ -n "$JAVA_HOME" ] && echo OK`.

### 2. adb

Homebrew `adb` (1.0.41) se cuelga en `start-server` y nunca abre 5037.
Usar el shim `~/.local/bin/adb` que delega al SDK platform-tools:

```bash
~/.local/bin/adb devices
```

Si el shim no existe, recrearlo:

```bash
ln -sf /Users/matiasgonzalocalvo/Library/Android/sdk/platform-tools/adb \
  ~/.local/bin/adb
```

### 3. Deep link antes del flow

`launchApp` + `openLink` dentro de Maestro **no navegan** en device físico
(quedan en la pantalla home). El workaround es disparar el deep link con
adb **antes** de correr el flow, dejando la pantalla destino visible para
el primer `assertVisible`:

```bash
adb shell am start -a android.intent.action.VIEW \
  -d copero://simulador-carrera/<destino> com.mgcstudios.copero
```

Cada flow documenta su propio pre-step en el header del YAML.

## Cómo correr

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
adb shell am start -a android.intent.action.VIEW \
  -d copero://simulador-carrera/club com.mgcstudios.copero
maestro test .maestro/club-ambicion.yaml
```

APK esperado: `build-138-preview-6422e8e.apk` (instalado manualmente por QA).
