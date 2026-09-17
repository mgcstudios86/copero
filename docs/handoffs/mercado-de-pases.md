# Handoff — Mercado de pases

**Flow source**: `docs/flows/mercado-de-pases/flow.md`
**Screens**: `docs/screens/mercado-de-pases/source/`

## Pantallas

1. **`01-lista-jugadores.html`** — Período de pases con header presupuestario
   - Header: chip "Período" + card presupuesto (€18.5M, cierre en 14 días, slots usados)
   - Body: search + filter chips (posición) + card rango (edad/valor) + list de jugadores con avatar-lg, OVR, potencial, valor, salario

2. **`02-detalle-jugador.html`** — Detalle individual con stats y ofertas
   - Header: back + favorito
   - Body: hero (avatar-xl + nombre + posición + chips OVR/Potencial) + card atributos (6 stats con progress bar) + card ofertas en curso (con highlight "Tu oferta") + card salario/cláusula

3. **`03-confirmacion-traspaso.html`** — Modal de confirmación con impacto
   - Header: "Confirmar operación"
   - Body: hero jugador + impacto presupuestario (antes/después grid) + delta moral + detalles operación + callout warning

## Componentes RN

- `<MarketHeader>` (card presupuestario)
- `<PlayerListItem>` (`list-item` con avatar-lg + 3 chips + precio)
- `<PlayerAttributesCard>` (progress bars)
- `<OffersList>` (lista con highlight)
- `<ConfirmTransferModal>` (bottom sheet pattern)

## Filtros y ordenamiento

- Filtros: posición (Todos/ARQ/DEF/MED/DEL), edad (range slider), valor (range slider)
- Orden: Rating / Valor / Edad / Potencial
- Búsqueda: text input con icono

## Tokens

- `colors('copero').primary` para CTAs y highlights
- `colors('copero').warning` para "margen restante bajo"
- `chip--success` para rating alto (88+)
- `chip--primary` para rating medio-alto (85-87)

## Estados

- Default: lista con filtros aplicados
- Empty: "No hay jugadores en el mercado" + CTA limpiar filtros
- Loading: spinner al cargar lista
- Error: "No se pudo cargar el mercado" + retry

## Acceptance criteria visuales

- [x] Lista jugadores disponibles con filtros (posición, valor, edad)
- [x] Detalle jugador + ofertas en curso
- [x] Pantalla confirmación traspaso (presupuesto antes/después, moral)