# Handoff — Post-match

**Flow source**: `docs/flows/post-match/flow.md`
**Screens**: `docs/screens/post-match/source/`

## Pantallas

1. **`01-resumen-partido.html`** — Resumen con resultado + MVP + lesionados + moral
   - Header: chip "Semana N · Resultado"
   - Body: card resultado final (AR vs BR + score + chip Victoria) + MVP card (highlight gradient primary-soft, 2 goles, 1 asist, rating 9.4) + card lesionados (danger) + card moral delta + card stats rápidas

2. **`02-eventos-clave.html`** — Timeline detallada con timestamps
   - Body: timeline vertical con minuto + chip evento (⚽ gol / 🟨 amarilla / 🔄 cambio / 🩹 lesión) + descripción
   - Footer: continuar temporada

3. **`03-cta-post-match.html`** — Grid de CTAs siguientes
   - Body: 5 cards con icono grande + acción siguiente (continuar temporada, ver tabla, stats jugador, ajustar táctica, guardar partida)

## Componentes RN

- `<MatchResultHero>` (score + equipos)
- `<MVPCard>` (`mvp-card` con gradient)
- `<InjuryCard>` (danger variant)
- `<MoralBar>` (progress + delta chip)
- `<EventTimeline>` (vertical timeline con chips)
- `<PostMatchCTAs>` (lista vertical de acciones)

## Eventos a renderizar

- `goal` (verde/primary)
- `yellow_card` (amarilla)
- `red_card` (roja, danger)
- `substitution` (info, blue)
- `injury` (danger, con duración)

## Tokens

- `colors('copero').success` para victoria
- `colors('copero').danger` para lesionados / derrota
- `colors('copero').primary` para gol del jugador + MVP highlight
- Gradient: `linear-gradient(135deg, primary-soft, surface)` para MVP card

## Acceptance criteria visuales

- [x] Resumen partido: resultado, MVP card, lesionados (duración), delta moral equipo
- [x] Lista eventos clave (goles, cambios, tarjetas)
- [x] CTAs: continuar temporada / ver tabla / ver estadísticas jugador