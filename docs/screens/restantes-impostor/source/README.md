# Mapeo HTML → Componente React Native

Esta capa `source/` es la **fuente primaria** que el mobile-developer lee. Mobile-developer traduce cada clase CSS a `StyleSheet.create()` y cada estructura a componente funcional RN.

## Sistema de tokens (`tokens.css`)

| Variable CSS | Equivalente RN (`src/design/tokens.ts`) | Uso |
|---|---|---|
| `--color-bg: #09090B` | `colors('copero').bg` | Background global |
| `--color-surface: #101012` | `colors('copero').surface` | Cards, tab-bar, footer |
| `--color-primary: #22C55E` | `colors('copero').primary` | CTA, chips activos, highlights |
| `--color-accent: #A855F7` | `colors('copero').accent` | Celebración, modo copero |
| `--color-success/warning/danger/info` | `colors('copero').success/warning/danger/info` | Estados semánticos |
| `--space-{0..10}` | `spacing['0..10']` | Padding, margin, gap |
| `--radius-{sm..pill}` | `radii.{sm..pill}` | Border-radius |
| `--text-{xs..3xl}` | `fontSize.{xs..3xl}` | Font-size |
| `--font-display/body/mono` | `fontFamily.{display/body/mono}` | Tipografías |

## Componentes primitives (`components.css`)

| Clase CSS | Componente RN sugerido | Notas |
|---|---|---|
| `.screen` | `<ScreenContainer>` | `flex: 1, backgroundColor: tokens.bg` |
| `.screen__header` | `<ScreenHeader>` | `sticky`, safe-area-top |
| `.screen__body` | `<ScrollView contentContainerStyle>` | Padding horizontal responsive |
| `.screen__footer` | `<ScreenFooter>` | Safe-area-bottom |
| `.btn--primary` | `<PrimaryButton>` | Pill shape, min-height 44 |
| `.btn--secondary` | `<SecondaryButton>` | Border 1px border-strong |
| `.btn--danger` | `<DangerButton>` | Para destructive actions |
| `.icon-btn` | `<IconButton>` | 44×44 square |
| `.card` | `<Card>` | surface bg, lg radius |
| `.card--accent` | `<CardAccent>` | primary border 1.5 |
| `.card--danger` | `<CardDanger>` | danger border |
| `.chip` | `<Chip>` | Pill, surface bg |
| `.chip--primary/success/warning/danger/info` | `<Chip variant>` | Mapeo 1:1 a variants |
| `.input__field` | `<TextInput>` | styled con focus ring primary |
| `.list-item` | `<ListItem>` | touch target 44 |
| `.avatar` | `<Avatar>` | circular, font display bold |
| `.modal` | `<BottomSheet>` | Sheet pattern RN |
| `.modal-backdrop` | `<Modal>` overlay | absolute inset 0 |
| `.tab-bar` | `<TabBar>` | 4 tabs, safe-area-bottom |
| `.cal-grid` | `<WeeklyCalendar>` | grid 7 cols |
| `.cal-grid__cell` | `<DayCell>` | aspect-ratio 1/1 |
| `.bracket` | `<PlayoffBracket>` | grid 3 cols (cuartos | semis | final) |
| `.bracket__match` | `<BracketMatch>` | surface, md radius |
| `.bracket__team` | `<BracketTeam>` | winner variant highlight |
| `.state` | `<EmptyState>` / `<LoadingState>` / `<ErrorState>` | Centrado, 72px icono |
| `.spinner` | `<ActivityIndicator>` | green-500 |
| `.progress` | `<ProgressBar>` | 6px height, pill |
| `.divider` | `<Divider>` | 1px border |
| `.flag` | `<CountryFlag>` | 24×16, gradient backgrounds |
| `.dots` / `<dots__dot` | `<PaginationDots>` | carousel pagination |
| `.toggle` | `<Switch>` | 44×26, primary on |
| `.stepper` | `<StepIndicator>` | 3 pasos para restart |
| `.carousel__hero` | `<OnboardingHero>` | 1:1 aspect |
| `.preset-card` | `<TeamPresetCard>` | onboarding |
| `.mvp-card` | `<MVPCard>` | post-match highlight |
| `.stat-strip` | `<StatStrip>` | 3 cols grid |
| `.save-slot` | `<SaveSlot>` | save-load |
| `.callout` | `<Callout>` | warning/info banner |
| `.toast` | `<Toast>` | save indicator |
| `.standings-table` | `<StandingsTable>` | tabla posiciones |
| `.filters` | `<FilterChips>` | horizontal scroll |
| `.coachmark` | `<Coachmark>` | tutorial overlay |

## Patrones de layout

- **Screen stack**: `.screen > [.screen__header, .screen__body, .screen__footer, .tab-bar]`
- **Card content**: `.card > [.card__row, .list, .stat-strip, .input]`
- **Modal pattern**: `.modal-backdrop > .modal > [.modal__handle, .modal__title, .card, .callout, .btn]`
- **Bracket**: `.bracket > .bracket__col*3 > .bracket__match > .bracket__team*2`
- **Calendar**: `.cal-grid > [.cal-grid__cell | 28]` con day-labels arriba

## Estados semánticos (i18n)

- **Empty**: icono + título + body + CTA "limpiar filtros"
- **Loading**: spinner + título "Cargando..." + body opcional
- **Error**: icono ⚠ + título + body + CTA "Reintentar"

## Breakpoints mobile-first

| Device class | Width | `@media` |
|---|---|---|
| Compact (Android low-end) | 360px | `@media (max-width: 374px)` |
| Standard (iPhone 14/15) | 390px | `@media (min-width: 375px) and (max-width: 414px)` |
| Pro Max (iPhone 15 Pro Max) | 430px | `@media (min-width: 415px)` |

El `.screen` aplica `max-width` por breakpoint. Safe area iOS via `env(safe-area-inset-*)`.