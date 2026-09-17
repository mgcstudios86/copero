---
feature: "mercado-de-pases"
project: "copero"
author: "flow-architect"
status: "draft"
created: "2026-09-17"
---

# Mercado de pases completo

## Trigger
Cierre de la semana 38 de la temporada regular o entrada manual desde Dashboard "Mercado de pases".

## Actor
Usuario jugador (revisa ofertas, acepta/rechaza, hace ofertas) + sistema (motor F3 transfer-offers con RNG determinista).

## Diagrama
```mermaid
flowchart TD
  A[Cierre semana 38 / Tapa Mercado] --> B{¿Ofertas pendientes?}
  B -- sí --> C[Mostrar listado de offers con decline-all 44dp]
  B -- no --> D[Mostrar "Sin ofertas"]
  C --> E{Acción usuario}
  E -- Aceptar --> F[Aceptar oferta + wire post-acceptance]
  E -- Rechazar --> G[Remover oferta + persistir]
  E -- Counter --> H[Abrir pantalla negociación counter]
  F --> I[Actualizar roster + salario + moral]
  G --> J{¿Quedan ofertas?}
  H --> K[Resolver counter oferta RNG]
  K --> J
  J -- sí --> E
  J -- no --> L[Salir mercado]
  D --> L
  I --> L
```

## Steps

### Step 1: Abrir mercado desde fin de temporada
- **Pantalla / Componente**: `src/features/career/transfer-offers/index.tsx` + `app/simulador-carrera/transfer-market.tsx`.
- **Acción del usuario**: Toca "Mercado de pases" en el banner de fin de semana 38.
- **Acción del sistema**: Carga `pendingOffers` desde `careerStore`, renderiza listado ordenado por bucket (bucket `[6.0, 7.0)` referencia ADR-0017).
- **Resultado esperado**: Lista de ofertas con club origen, monto, duración del contrato y rol del jugador.
- **Caminos alternativos**: Sin ofertas → empty state "No hay ofertas esta temporada"; oferta expirada → removida automáticamente.

### Step 2: Revisar oferta individual
- **Pantalla / Componente**: `src/features/career/transfer-offers/offer-card.tsx`.
- **Acción del usuario**: Toca una oferta del listado.
- **Acción del sistema**: Expande card con detalle completo (sueldo, bonus, cláusula de rescisión, fixture esperado del club destino).
- **Resultado esperado**: Card expandida con todos los términos visibles.
- **Caminos alternativos**: HitSlop 44dp WCAG en decline-all (MGC-1991) garantiza accesibilidad.

### Step 3: Aceptar oferta
- **Pantalla / Componente**: `src/features/career/transfer-offers/accept-offer.tsx`.
- **Acción del usuario**: Toca "Aceptar" en la card expandida.
- **Acción del sistema**: Ejecuta `acceptOffer(offerId)` → wire post-acceptance (MGC-1730 F3.2), actualiza `careerStore.teamId`, persiste AsyncStorage.
- **Resultado esperado**: Modal "¡Transferencia confirmada!" + transición al nuevo club con stats heredadas.
- **Caminos alternativos**: Si la oferta fue retirada por el club (race condition) → toast "Oferta expirada" + refresh.

### Step 4: Rechazar oferta individual
- **Pantalla / Componente**: `src/features/career/transfer-offers/decline-offer.tsx`.
- **Acción del usuario**: Toca "Rechazar" en la card.
- **Acción del sistema**: Ejecuta `declineOffer(offerId)`, persiste decisión, decrementa `pendingOffers`.
- **Resultado esperado**: Oferta removida del listado, animación slide-out.
- **Caminos alternativos**: Rechazo masivo "Decline all" → recorre todas las ofertas en batch (default 44dp hitSlop).

### Step 5: Counter oferta (negociación)
- **Pantalla / Componente**: `src/features/career/transfer-offers/counter.tsx`.
- **Acción del usuario**: Toca "Negociar" y propone nuevo monto/duración.
- **Acción del sistema**: Llama `resolveCounterOffer(offerId, proposal)` → RNG determinista (`rng.transferCounter`) acepta/rechaza/counter.
- **Resultado esperado**: Resultado de negociación renderizado en ≤2s.
- **Caminos alternativos**: Club acepta → modal de confirmación; club hace counter → vuelve a Step 2 con nuevos términos.

### Step 6: Salir al Dashboard
- **Pantalla / Componente**: `app/simulador-carrera/dashboard.tsx`.
- **Acción del usuario**: Toca back o gesture swipe.
- **Acción del sistema**: Persiste estado final del mercado, dispara telemetría `analytics.market_closed`.
- **Resultado esperado**: Vuelve al Dashboard con banner "Mercado cerrado — temporada N+1 inicia".
- **Caminos alternativos**: Swipe back con ofertas sin resolver → modal "Tienes N ofertas sin resolver, ¿salir?".

## Edge cases
| Escenario | Comportamiento esperado |
|-----------|-------------------------|
| Jugador con 0 ofertas y bucket >= 7.0 | Ofertas aleatorias: mínimo 1 oferta de club top-tier (rating > 80). |
| Oferta retirada por el club durante la sesión | Refresh silencioso + toast "Oferta retirada por <club>". |
| Counter oferta rechazada por el jugador | Counter oferta persiste 24h in-game; expira automáticamente. |
| Jugador con lesión grave activa | Mostrar advertencia "El club podría reducir la oferta por la lesión actual". |
| Force-stop durante la aceptación | Snapshot pre-acceptance persiste; al reabrir, oferta sigue pendiente. |
| Bucket vacío `[0, 6.0)` | Sin ofertas; el jugador permanece en su club actual. |

## Pre-condiciones
- Temporada actual cerrada o el jugador navega manualmente al mercado.
- `careerStore.pendingOffers` contiene al menos 1 oferta (si no → empty state).
- Persistencia AsyncStorage activa.

## Post-condiciones
- Aceptar oferta: `careerStore.teamId` actualizado, stats heredadas preservadas, moral reseteada al baseline del nuevo club.
- Rechazar: `pendingOffers` decrementada, contador de rechazos incrementado.
- Counter: nueva propuesta persistida con timestamp.

## Validación
- E2E: `tests/e2e/transfer-market.spec.ts` cubre aceptar/rechazar/counter.
- Unit: `src/features/career/transfer-offers/accept-offer.test.ts` cubre race conditions.
- Métricas: `analytics.offer_accepted`, `analytics.offer_declined`, `analytics.counter_resolved`.
- QA gate: corrida manual con bucket range [6.0, 7.0) verificada.

## Dependencias externas
- AsyncStorage para persistencia de decisiones.
- RNG determinista (ADR-0016) para counter oferta.
- i18n para mensajes de oferta (ver flow `i18n-es-en-pt`).
- Notificación push opcional (futuro feature) para ofertas entrantes.

## Out of scope
- Mercado de pases en tiempo real entre jugadores humanos.
- Subastas con bidding war entre múltiples clubes.
- Cláusula de rescisión dinámica negociable.
- Sistema de representación/agentes (futuro feature).