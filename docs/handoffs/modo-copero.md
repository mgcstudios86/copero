# Handoff — Modo Copero

**Flow source**: `docs/flows/modo-copero/flow.md`
**Screens**: `docs/screens/modo-copero/source/`

## Pantallas

1. **`01-seleccion-copa.html`** — Selección de copa nacional con bracket inicial
   - Hero: icono 🏆 + título "Copa nacional · 16 equipos"
   - Body: bracket 4 columnas (8 partidos de octavos) con tu equipo marcado con ★
   - Footer: "Iniciar octavos" / "Ver copas internacionales"

2. **`02-calendario-copa.html`** — Calendario de la fase actual
   - Header: filters chips (Octavos/Cuartos/Semis/Final)
   - Body: phase banner (gradient accent) + list de partidos con cards (HOY/Pendiente)

3. **`03-modal-celebracion.html`** — Modal bottom-sheet al ganar la copa
   - Hero: 🏆 grande + "CAMPEÓN"
   - List premios: €5M, +25 moral, +150 prestigio, clasificación internacional

## Componentes RN

- `<CupSelector>` (hero + grid brackets)
- `<CupBracket16>` (4 cols × 2 partidos = 8 partidos de octavos)
- `<CupPhaseBanner>` (gradient accent)
- `<CupMatchCard>` (cards con vs + CTA jugar)
- `<CupCelebrationModal>` (bottom sheet con premios)

## Tokens

- `colors('copero').accent` (#A855F7) para header copa y modal celebración
- Gradient `accent-soft → surface` para phase banner
- `chip--primary` para "CAMPEÓN"
- `chip--success` para premios desbloqueados

## Estados clave

- Default: bracket octavos + 1 partido HOY
- Empty: sin copas disponibles → "Ver copas internacionales"
- Loading: simulación partido en curso
- Won: modal con premios (única vía válida para mostrar celebration, no alert nativo)

## Acceptance criteria visuales

- [x] Pantalla selección copa nacional (bracket inicial)
- [x] Calendario copa + fase actual
- [x] Modal celebración al ganar copa