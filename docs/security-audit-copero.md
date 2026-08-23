# Auditoría de seguridad — Copero (MGC-325 / C5)

- **Issue**: MGC-325
- **Auditor**: Security Lead (agent 813000a3)
- **Fecha**: 2026-08-22
- **Alcance**: repositorio `copero/` antes del primer release.
- **Padre**: MGC-286 (Copero, in_progress).
- **Versión auditada**: `package.json` v0.1.0 (Expo 57, RN 0.86, zustand 5).

## Resumen ejecutivo

| Categoría | Estado | Severidad |
| --- | --- | --- |
| Secretos en repo | OK | — |
| Consumo de `EXPO_PUBLIC_*` desde Infisical | GAP | Media |
| Privacidad AdMob / GDPR-CCPA | GAP | Alta |
| Persistencia (PII / `localStorage`) | OK | — |
| Configuración Expo / `app.json` | OK | — |

Resultado: **sin findings críticos bloqueantes**. Dos hallazgos de severidad media/alta requieren remediación antes del primer release público que muestre anuncios en UE/CA (MGC-292 ya los cubre como bloqueante). La recomendación de prompt de consentimiento queda registrada como follow-up en MGC-319.

---

## 1. Inventario y búsqueda de secretos

Comandos ejecutados:

- `grep -rE 'ca-app-pub-[0-9]+' --include='*.{ts,tsx,js,json}' .` → 0 coincidencias (excluye `node_modules`, lockfiles y `dist/`).
- `find . -maxdepth 3 -name '.env*' -not -path './node_modules/*'` → 0 ficheros.
- `grep -rE 'EXPO_PUBLIC_|infisical' --include='*.{ts,tsx,js,json}' .` → 0 referencias en código fuente (únicas menciones: `process.env.CI`, `process.env.EXPO_WEB_BASE_URL` en `e2e/playwright.config.ts`, no son secretos).
- Inspección de `app.json` (único config Expo) → bloque `expo.extra` ausente; sin claves hardcoded.
- Inspección de `provider.web.tsx` → `data-ad-client={slotId ?? 'ca-pub-XXXXXXXXXXXXXXXX'}` (placeholder explícito con `X`, no es un ID real).
- Inspección de `provider.native.tsx` → placeholder sin IDs (sin `react-native-google-mobile-ads` instalado: `package.json` no lo declara).

**Conclusión**: no se encontró ningún secreto real (AdMob unit IDs, claves de API, tokens) en el código fuente ni en artefactos versionados. El único AdMob ID presente es un placeholder visible (`ca-pub-XXXXXXXXXXXXXXXX`).

---

## 2. Consumo de `EXPO_PUBLIC_*` desde Infisical

Hallazgos:

- `app.json` no tiene bloque `expo.extra` ni declara `EXPO_PUBLIC_*`.
- No existe `app.config.js` que consuma `process.env.EXPO_PUBLIC_*`.
- `package.json` declara `@react-native-async-storage/async-storage` (storage) pero **no** `react-native-google-mobile-ads`.
- `eas.json` no define `env` por perfil; los builds production/preview cargan variables desde el runtime de EAS (fuera del repo).

**Gap (severidad media)**: todavía no hay un path explícito `Infisical → EXPO_PUBLIC_* → runtime nativo`. Cuando MGC-292 integre `react-native-google-mobile-ads`, los IDs reales (`EXPO_PUBLIC_ADMOB_APP_ID_IOS`, `EXPO_PUBLIC_ADMOB_APP_ID_ANDROID`, `EXPO_PUBLIC_ADMOB_BANNER_ID`, `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID`) deben venir de Infisical y montarse en `app.config.js` con `dotenv`/`infisical run`. Hoy no hay nada que migrar (los IDs reales aún no se cargaron), por lo que **no existe fuga actual**, pero **el contrato de secreto aún no está formalizado**.

**Acción recomendada** (preventiva, pre-release):

- Crear `app.config.js` que lea `EXPO_PUBLIC_*` y los inyecte en `expo.extra` / `ios.config.googleMobileAdsAppID` / `android.config.googleMobileAdsAppID`.
- Definir entradas en Infisical bajo `mgcstudios/copero/<slot>` (`banner-id`, `interstitial-id`, `app-id-ios`, `app-id-android`) y registrarlas en `paperclip/secrets-mapping.yaml` a nivel empresa.
- Verificar arranque con `MGC_PAPERCLIP_USE_INFISICAL=1 infisical run -- npx expo prebuild --no-install`.

---

## 3. Privacidad AdMob — GDPR / CCPA

Hallazgos:

- `src/features/ads/provider.web.tsx` y `provider.native.tsx` son **placeholders visuales** (muestran `PUBLICIDAD`/`AdMob slot`/`Espacio publicitario full-screen`). **No** cargan scripts de AdSense ni instancias de AdMob.
- `provider.web.tsx` sí emite un `<ins class="adsbygoogle">` con `data-ad-client` placeholder; sin la inyección real del script de AdSense, **no se sirve ningún anuncio** hoy.
- `src/shared/store/adsStore.ts` mantiene `interstitialPending`/`interstitialShown` pero **no** persiste consentimiento y **no** consulta ningún SDK de consentimiento (UMP / AdSense `__googLocator`).
- `Interstitial` se renderiza cuando `open === true` sin gate de consentimiento.
- `Banner` se renderiza sin gate de consentimiento.
- No hay dependencias de `@react-native-google-mobile-ads` ni `react-native-consent`/`@google-mobile-ads-consent`.

**Gap (severidad alta, pre-release UE/CA)**:

- No existe prompt de consentimiento pre-ad (GDPR Art. 6 / ePrivacy; CCPA "Do Not Sell"). Recomendación documentada como follow-up en MGC-319.
- Cuando se integre el SDK real (`react-native-google-mobile-ads`), el `Banner` debe ocultarse en UE hasta que `AdsConsent.getConsentStatus() === AdsConsentStatus.PERSONALIZED` o `NON_PERSONALIZED` (lo que el usuario elija). El `Interstitial` debe bloquearse si el usuario está en `UNKNOWN` y aún no pasó por el UMP.

**Recomendación (no implementar en este ticket — alcance excluido)**:

- Integrar Google User Messaging Platform (UMP) en `provider.native.tsx` y `ConsentMode v2` para AdSense en web.
- Añadir estado `consent: 'unknown' | 'granted' | 'denied' | 'not_required'` en `adsStore.ts` y gate en `Banner`/`Interstitial`.
- Persistir la decisión de consentimiento en el mismo `storage` adapter (clave `copero-consent`) — **no es PII**, es preferencia funcional del usuario.
- Mostrar el banner de "Choices" de Google (AdChoices) en cada unidad servida.

---

## 4. Persistencia — `storage.ts` y `localStorage`

Hallazgos:

- `src/shared/store/storage.ts` expone solo un adapter `StateStorage` (web → `localStorage`, mobile → `AsyncStorage`). Cumple la interfaz de `zustand/middleware/persist`.
- `src/shared/store/gameStore.ts` persiste **únicamente** bajo la clave `copero-game` con `partialize` que filtra a `{ highScore, bestStreak }`. No persiste `currentWord`, `status`, `rounds`, `score`, `streak`, `timerMsRemaining`. **Sin PII**.
- `useAdsStore` (`adsStore.ts`) **no** usa `persist` — el estado de ads es efímero.
- No se identificaron otras claves `localStorage`/`sessionStorage` en el código fuente.

Claves expuestas actualmente:

| Key | Storage | Contenido | PII |
| --- | --- | --- | --- |
| `copero-game` (parcial) | `localStorage` / AsyncStorage | `{ highScore, bestStreak }` | No |
| `copero-consent` (propuesto) | idem | estado de consentimiento AdMob | No |

**Conclusión**: no se persiste PII. El adaptador es seguro (try/SSR-safe con guard `typeof window === 'undefined'`).

---

## 5. Otros hallazgos

- `app.json` declara `userInterfaceStyle: 'dark'` y `newArchEnabled: true` — sin impacto de seguridad.
- `ios.bundleIdentifier` y `android.package` visibles: `com.mgcstudios.copero`. No son secretos; son identificadores públicos del binario.
- `eas.json` no expone credenciales; usa `autoIncrement` y `distribution: internal` en `development`/`preview`. Sin tokens EAS en repo.
- `index.ts`, `App.tsx`, `expo-router` declarados pero sin rutas que carguen assets sensibles.
- `.gitignore` no inspeccionado en este pase (recomendado: confirmar que ignora `.env`, `*.keystore`, `*.jks`, `dist/`).

---

## 6. Checklist de aceptación (MGC-325)

- [x] `grep ca-app-pub-[0-9]+` solo devuelve TestIds/placeholder → **sin secretos reales**.
- [x] `app.config.js` aún no existe; cuando se cree debe consumir solo `EXPO_PUBLIC_*` desde Infisical → **gap documentado**.
- [x] `src/components/ads/*` (en este repo: `src/features/ads/*`) revisado; respeta consentimiento **solo cuando se integre el SDK real** → **gap documentado como severidad alta pre-release UE/CA**.
- [x] Prompt de consentimiento pre-ad **recomendado**, no implementado (alcance excluido) → **seguimiento en MGC-319**.
- [x] `src/shared/store/storage.ts` no persiste PII (solo progreso del quiz) → **OK**.
- [x] Auditoría de claves `localStorage`/`sessionStorage` → única clave real: `copero-game` (parcial). **OK**.

---

## 7. Recomendaciones priorizadas

1. **(Alta, pre-release)** Integrar UMP / Consent Mode v2 y gate de consentimiento en `Banner` e `Interstitial`. Bloqueante para lanzamientos en UE/CA.
2. **(Media, pre-MGC-292)** Crear `app.config.js` con `EXPO_PUBLIC_*` desde Infisical. Registrar entradas en `paperclip/secrets-mapping.yaml`.
3. **(Baja)** Confirmar `.gitignore` cubre `.env*`, `*.keystore`, `*.jks`, `google-services.json`, `GoogleService-Info.plist`, `dist/`.
4. **(Baja)** Cuando se carguen los IDs reales, rotar el placeholder `ca-pub-XXXXXXXXXXXXXXXX` y validar en CI (`grep -E 'ca-app-pub-[0-9]{10,16}' src/` → debe devolver 0).

---

## 8. Sign-off

- Auditor: Security Lead (agent 813000a3).
- Resultado: **APROBADO CON OBSERVACIONES** — sin findings críticos bloqueantes. Los dos gaps (consenso AdMob y contrato Infisical→EXPO_PUBLIC_*) son requisitos del release real cubiertos por MGC-292 (AdMob) y por el seguimiento en MGC-319 (consent prompt).
- Evidencia: este documento (`docs/security-audit-copero.md`).
