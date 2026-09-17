# Handoff — Onboarding fresh user

**Flow source**: `docs/flows/onboarding-fresh-user/flow.md`
**Screens**: `docs/screens/onboarding-fresh-user/source/`

## Pantallas

1. **`01-welcome-carousel.html`** — Slide 1/3 (estructura replicable para los otros 2)
   - Header: "Saltar" + "1 de 3"
   - Body: hero 1:1 + texto + pagination dots (1 activo, 2 inactivos)

2. **`02-seleccion-equipo.html`** — Selección inicial con 3 presets + custom
   - Header: "Paso 2 de 3"
   - Body: grid 3 cols con `<PresetCard>` (AR/BR/ES) + card custom (input nombre + dorsal)
   - Card resumen selección

3. **`03-tutorial-primer-partido.html`** — Tutorial interactivo primer partido
   - Header: "Saltar tutorial" + "3 de 3"
   - Body: card gradient accent + match preview + 3 coachmarks numerados + CTA táctica (Ofensiva/Equilibrada/Defensiva)

## Componentes RN

- `<OnboardingCarousel>` (3 slides, dots)
- `<OnboardingSlide>` (hero + texto + dots)
- `<TeamPresetCard>` (`preset-card` con crest + name + meta)
- `<CustomTeamCard>` (input nombre + dorsal)
- `<Coachmark>` (overlay numerado con título + body)

## Tokens

- `colors('copero').accent` (#A855F7) para card tutorial
- `colors('copero').primary` para "Saltar" / selected preset
- Gradient `accent-soft → surface` para hero tutorial

## Flujo del wizard

1. Bienvenida (slide 1/3) → idioma (re-usa flow i18n) → equipo (preset o custom) → tutorial primer partido → temporada 1

## Acceptance criteria visuales

- [x] Welcome carousel 3 slides (ES/EN/PT auto-detect)
- [x] Selección de equipo inicial (3 presets + custom name)
- [x] Tutorial interactivo primer partido

## Lo que NO está incluido

- Lógica de dificultad por preset
- Onboarding de dificultades (futuro)