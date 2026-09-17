# Handoff — Temporada loop 5+ semanas + playoffs + fin de año

**Flow source**: `docs/flows/temporada-loop-5-semanas-playoffs/flow.md`
**Screens**: `docs/screens/temporada-loop-5-semanas-playoffs/source/`

## Pantallas

1. **`01-calendario-semanal.html`** — `app/simulador-carrera/calendar.tsx` + `src/features/simulador-carrera/screens/calendar.tsx`
   - Header: Temporada N · Semana M + chip "Fase regular" / "Playoffs"
   - Body: progress bar temporada (W/38) + grid 7×4 días (jugados/hoy/pendientes) + card partido del día (Jugar partido) + stat-strip (PJ/PG/DG) + card proyección playoffs
   - Footer: tab-bar (Temporada/Equipo/Copas/Stats)

2. **`02-playoffs-bracket.html`** — `src/features/simulador-carrera/screens/playoff.tsx`
   - Header: chip "Cuartos/Semis/Final"
   - Body: bracket 3 columnas (cuartos | semis | final) con partidos renderizados + callout próximo partido

3. **`03-fin-de-ano.html`** — `app/simulador-carrera/season-summary.tsx`
   - Hero: podium 1/2/3 con avatar-xl del campeón
   - Body: stat-strip temporada + tabla final posiciones + achievements unlocked
   - Footer: Nueva carrera / Restart limpio / Compartir

## Componentes RN

- `<WeeklyCalendar>` (`cal-grid`) — grid 7×4, day cells con aspect-ratio 1/1
- `<MatchCard>` (`card--accent`) — para "Jugar partido"
- `<PlayoffBracket>` (`bracket`) — 3 columnas flex
- `<Podium>` — hero fin de año
- `<StandingsTable>` (`standings-table`)
- `<AchievementList>` (`list list--gap-md` con emoji + chip bonus)

## Tokens a usar (de `src/design/tokens.ts`)

- `colors('copero')` para toda la paleta
- `radii.lg` para cards, `radii.pill` para CTAs/chips
- `spacing[3..5]` para padding
- `fontSize.lg/xl` para h3, `fontSize['2xl']` para h2
- `tapTarget` (44) para touch targets

## Estados clave (mockupeados)

- Default: calendario con día actual + partido del día
- Loading: spinner al "Jugar partido" (simula partido)
- Empty: temporada no iniciada → onboarding
- Error: lesión grave → reemplazo por `bestPlayerByPosition`

## Acceptance criteria visuales (del flow)

- [x] Calendario semanal: grid 7 días, partidos jugados/pendientes, badge playoffs últimas 2 semanas
- [x] Pantalla playoffs: bracket 4 equipos, partidos ida/vuelta (single elimination en este flow, ver §Aclaraciones)
- [x] Pantalla fin de año: podium + tabla final + CTAs restart/nueva-carrera

## Aclaraciones

- El flow dice "ida/vuelta" pero el bracket se muestra single elimination por claridad visual. La lógica de doble partido queda en el motor (`careerStore.season.playoffMatches[]`).

## Lo que NO está incluido

- Lógica de simulación (`simulateMatch()`)
- `maybeCareer` (lesiones post-match)
- Persistencia AsyncStorage (`bootstrapPersistence`)
- Modal de celebración nativo (`react-native-reanimated`) — ver flow `modo-copero`