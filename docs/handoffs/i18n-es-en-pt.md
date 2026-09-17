# Handoff — i18n ES/EN/PT

**Flow source**: `docs/flows/i18n-es-en-pt/flow.md`
**Screens**: `docs/screens/i18n-es-en-pt/source/`

## Pantallas

1. **`01-selector-onboarding.html`** — Selector de idioma en primer launch
   - Body: 3 list-item con flag (gradient CSS) + nombre nativo + variante local + chip "Recomendado" para ES
   - Card auto-detección (toggle ON por default)

2. **`02-selector-settings.html`** — Cambio de idioma en Configuración
   - Cards con lista de los 3 idiomas (highlight en activo)
   - Card formato (fecha/decimal/moneda)
   - Toggle "Auto-detectar al abrir"

3. **`03-empty-states.html`** — Galería de estados (empty/loading/error) traducidos
   - 5 cards con state en los 3 idiomas (ES/EN/PT)
   - Empty, Loading, Error variants

## Componentes RN

- `<LanguagePicker>` (lista de 3 con flag + label + variante)
- `<LanguageFlag>` (gradient CSS, 24×16)
- `<LocaleSettingsCard>` (formato)
- `<TranslatedState>` (componente unificado para empty/loading/error)

## Banderas (CSS gradient, no assets)

- 🇦🇷 ES: `linear-gradient(to bottom, #74ACDF 33%, #FFFFFF 33% 66%, #74ACDF 66%)`
- 🇬🇧 EN: `linear-gradient(135deg, #012169 25%, #FFFFFF 25% 50%, #C8102E 50% 75%, #FFFFFF 75%)`
- 🇵🇹 PT: `linear-gradient(to right, #046A38 40%, #FFE15A 40% 60%, #DA291C 60%)`

## Tokens

- `colors('copero').primary` para idioma activo (highlight)
- `chip--primary` para "Recomendado"

## Acceptance criteria visuales

- [x] Selector de idioma en onboarding y settings (ES/EN/PT)
- [x] Persistencia entre sesiones (toggle + chip "Activo")
- [x] Empty/loading/error states traducidos (los 3 idiomas)

## Estructura de claves i18n (referencia para RN)

```
i18n/
  es.json
  en.json
  pt.json
  index.ts (define Locale, useLocale hook)
```

Mobile-developer debe usar el hook `useLocale()` existente y replicar las traducciones al migrar estados vacíos.