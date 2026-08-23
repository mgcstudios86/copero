# Ads — Runbook operativo (Copero / MGC-323)

> Configuración de AdMob (banner + interstitial) sobre `react-native-google-mobile-ads`,
> con secretos en Infisical (`path=/copero`) y Dev Client via EAS profile `development`.

## TL;DR

- **Dev / CI / preview**: `EXPO_PUBLIC_ADMOB_ENABLED=false` → TestIds oficiales de Google.
  La app muestra ads reales del inventario de prueba (no facturan).
- **Producción (Play Store / TestFlight)**: `EXPO_PUBLIC_ADMOB_ENABLED=true` + IDs reales
  en Infisical `path=/copero`. El binario se firma con esos IDs.
- **Secretos nunca en repo**: `.env` está ignorado; los valores se inyectan desde Infisical
  en CI (`ci.yml`, `eas.yml`) y desde `.env` local sólo para dev manual.

## 1. Estructura de secretos en Infisical

Path: `/copero` (proyecto configurado en GitHub repo var `INFISICAL_PROJECT_ID`).

| Variable | `env=dev` (TestIds) | `env=prod` (reales, ejemplo) |
| --- | --- | --- |
| `EXPO_PUBLIC_ADMOB_ENABLED` | `false` | `true` |
| `EXPO_PUBLIC_ADMOB_APP_ID_BANNER` | `ca-app-pub-3940256099942544/6300978111` | `ca-app-pub-XXXX/YYYYYY` (Android) + `ca-app-pub-XXXX/ZZZZZZ` (iOS, mismo secret; SDK elige) |
| `EXPO_PUBLIC_ADMOB_APP_ID_INTERSTITIAL` | `ca-app-pub-3940256099942544/1033173712` | `ca-app-pub-XXXX/WWWWWW` (Android) + `ca-app-pub-XXXX/VVVVVV` (iOS) |

> Las IDs de banner e interstitial por plataforma se manejan en el provider nativo
> mediante `Platform.OS` cuando se requiera separar IDs reales Android/iOS.
> Si necesitamos IDs distintas por plataforma, abrir ticket de seguimiento.

### Cómo rotar TestIds → IDs reales (procedimiento)

1. Crear la app en [AdMob](https://apps.admob.com/) → obtener `App ID` (formato `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`) y `Ad unit ID` para banner + interstitial.
2. En Infisical, ir a `path=/copero`, `env=prod`:
   - `EXPO_PUBLIC_ADMOB_ENABLED` = `true`
   - `EXPO_PUBLIC_ADMOB_APP_ID_BANNER` = `ca-app-pub-XXXX/YYYYYY` (Android banner)
   - `EXPO_PUBLIC_ADMOB_APP_ID_INTERSTITIAL` = `ca-app-pub-XXXX/ZZZZZZ` (Android interstitial)
3. Verificar que el secret `INFISICAL_TOKEN` de GitHub Actions tiene acceso al
   proyecto y al path `/copero` (rol: `Developer` o superior).
4. Disparar build de release:
   ```bash
   eas build --local --profile production --platform android --non-interactive
   ```
5. Validar en consola de AdMob que el `Ad unit` reporta impressions (puede tardar
   hasta 30 min en aparecer tráfico).

### Rollback a TestIds

1. En Infisical `env=prod` poner `EXPO_PUBLIC_ADMOB_ENABLED=false` (o sobrescribir
   los IDs a TestIds).
2. Re-build de release.
3. Postear incidente en el ticket relacionado y avisar al operador.

## 2. Variables de entorno

`.env.example` contiene la estructura completa. Para dev local:

```bash
cp .env.example .env
# editar .env con TestIds (default) o IDs reales si querés probar
```

> **No commitear `.env`** — está en `.gitignore`. El operador lo genera en cada
> máquina nueva.

## 3. Instalación del módulo nativo (una vez por máquina)

El módulo `react-native-google-mobile-ads` requiere rebuild nativo. CI web **no**
lo necesita (sólo lint/typecheck/test sobre JS); EAS preview sí.

```bash
npm install react-native-google-mobile-ads
cd ios && pod install && cd ..   # sólo macOS
npx expo prebuild --no-install  # regenera android/ios con el plugin
```

Si el módulo no está instalado, `provider.native.tsx` cae automáticamente al
placeholder (`ad-banner-native`, `ad-interstitial-native` con
copy indicando "AdMob TestId"). Esto evita romper el bundle en CI web y los tests.

## 4. Comandos frecuentes

```bash
# Build dev client (Android, perfil development)
eas build --local --profile development --platform android

# Build preview interno (ambos platforms)
eas build --local --profile preview --non-interactive

# Build de release a producción (usa /copero env=prod)
eas build --local --profile production --platform android

# Verificar carga de secretos en CI
infisical export --projectId="$INFISICAL_PROJECT_ID" --env=dev --path=/copero --format=dotenv
```

## 5. Validación post-deploy

1. **Banner**: abrir Dev Client → banner inferior visible. En modo TestId aparece
   el label "AdMob TestId"; en modo real muestra un ad real.
2. **Interstitial**: terminar una partida → pantalla `fin` → overlay se dispara
   (gestionado por `app/fin.tsx` → `useAdsStore.requestInterstitial()`).
3. **Logs de consola**: `npx expo start --dev-client` debe mostrar
   `AdMob: SDK initialized` al primer render del banner.
4. **AdMob console**: verificar impressions en la unidad configurada dentro de
   los 30 minutos posteriores al build.

## 6. Troubleshooting

| Síntoma | Causa probable | Fix |
| --- | --- | --- |
| Banner no aparece | `EXPO_PUBLIC_ADMOB_ENABLED=false` y no hay placeholder | Verificar que `provider.native.tsx` se montó (debería ver `testID="ad-banner-native"`) |
| `Cannot find module 'react-native-google-mobile-ads'` | Módulo no instalado | `npm install react-native-google-mobile-ads && npx expo prebuild --no-install` |
| Banner muestra error rojo "Ad failed to load" | `App ID` incorrecto o unidad sin inventario | Verificar IDs en Infisical; en prod, verificar que la app fue añadida a AdMob |
| Interstitial no dispara | `useAdsStore.requestInterstitial()` no se llamó | Verificar que `app/fin.tsx` se está navegando (gameStore `status === 'gameEnd'`) |
| CI falla cargando secretos | `INFISICAL_TOKEN` o `INFISICAL_PROJECT_ID` ausente | Revisar GitHub repo secrets; los jobs actuales warn pero no rompen |
| Build EAS production falla | `eas.json` no tiene `env` y el secret quedó en `.env` local | Confirmar que en `eas.json` profile `production` NO están las TestIds (deja que Infisical las inyecte en runtime) |
| `eas.json is not valid. "build.preview.simulator" is not allowed` | Schema eas-cli exige `ios.simulator` anidado | Mover `simulator: true` a `build.preview.ios.simulator` |

## 7. Política

- AdMob sólo se monta si los IDs vienen de Infisical o del binario firmado.
- **Nunca** commitear `ca-app-pub-...` reales en el repo (ni siquiera en
  comentarios) — son identificadores del publisher account.
- Cualquier cambio de IDs reales abre ticket `correction` con `assigneeAgentId`
  del owner de AdMob (CEO) y referencia al ticket C3 padre.
- Rollback automático si impressions en AdMob muestran >50% de error rate en
  las primeras 24h post-release.
