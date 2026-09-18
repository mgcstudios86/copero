---
feature: "temporada-loop-5-semanas-playoffs"
project: "copero"
author: "mobile-developer"
status: "in_review"
created: "2026-09-18"
updated: "2026-09-18"
parent_issue: "MGC-487"
parent_umbrella: "MGC-463"
spec_doc: "docs/flows/temporada-loop-5-semanas-playoffs/flow.md"
---

# MGC-487 — Handoff: Temporada loop 5+ semanas + playoffs + fin de año

> Handoff de implementación para `qa` y reviewer. Cubre el gap
> restante entre la spec del flow (PR #655, commit 8e866e3) y la
> superficie jugable en el simulador (MGC-212 / MGC-265 / MGC-386 ya
> mergeados).

## Resumen ejecutivo

| Step spec | Estado pre-PR | Estado en este PR |
|-----------|---------------|---------------------|
| 1. Calendar semanal | ✅ MGC-212 / MGC-386 | sin cambios |
| 2. Match engine | ✅ `simulation.ts#advanceWeek` | sin cambios |
| 3. Stats jugador | ✅ `weekly-action.ts` | sin cambios |
| 4. Detección fin fase regular | ✅ `phase.ts#phaseFromWeek` | sin cambios |
| 5. **Playoffs bracket** | ❌ placeholder en `phase.ts` | ✅ nuevo módulo `playoff.ts` + UI `playoff.tsx` |
| 6. **Cierre de temporada** | ⚠️ rollover implícito en `advanceWeek` | ✅ helper explícito `season-rollover.ts` + UI `season-summary.tsx` |

## Archivos nuevos

```
src/features/career/playoff.ts                  ← generador puro de bracket (8 equipos)
src/features/career/playoff.test.ts             ← 10 tests (semilla, BYE, semis, final, campeón)
src/features/career/season-rollover.ts          ← helper puro rollover (week ≥ 38)
src/features/career/season-rollover.test.ts     ← 5 tests (semana, edad, archivo)
src/features/simulador-carrera/screens/playoff.tsx   ← UI bracket (3 rondas + campeón)
src/features/simulador-carrera/screens/season-summary.tsx ← UI cierre + preview rollover
app/simulador-carrera/playoff.tsx               ← ruta Expo Router
app/simulador-carrera/season-summary.tsx        ← ruta Expo Router
docs/handoffs/temporada-loop-5-semanas-playoffs.md   ← este doc
```

## Decisiones técnicas

### 1. Bracket generator (playoff.ts)

- **Pure function**, determinista vía `BracketRng` injectable (mismo
  patrón que `phase.ts#buildCalendar`). Esto preserva la barra #7 de
  `strategies.md` (calendarios/brackets estables entre cargas).
- **Sembrado estándar single-elim**: #1 vs #8, #2 vs #7, #3 vs #6,
  #4 vs #5.
- **BYE automático** si hay menos de 8 equipos en la tabla (los 4
  mejores pasan directo a semis). El spec Step 4 menciona este caso:
  "Tabla con menos de 8 equipos → Playoffs degradan: solo los 4
  mejores juegan semis+final; bye automático."
- **3 rondas**: cuartos (semanas 35–36), semis (37), final (38).
  Los slots se asignan uno por semana (`PLAYOFF_START_WEEK + slot`)
  para no necesitar pantalla por ronda.

### 2. Resolución de partido (placeholder)

`resolvePlayoffMatch` usa un `rng.int(0, 1)` 50/50 determinista como
placeholder. La integración con el motor real
(`match.ts#resolveMatch` que pondera por OVR) queda fuera de scope
para este PR — sería el siguiente ticket si QA detecta que el bracket
se siente "plano".

### 3. Season rollover (season-rollover.ts)

- Helper puro que documenta el contrato que `advanceWeek` aplica
  implícitamente cuando `week >= 38`. Útil para:
  - **Tests unitarios** explícitos del contrato.
  - **`season-summary.tsx`** que necesita archivar la temporada
    cerrada en `history[]` antes de persistir.
- No toca AsyncStorage directamente (delega al `careerStore`).

### 4. i18n

**No tocado.** Las dos pantallas nuevas (`playoff.tsx`,
`season-summary.tsx`) usan strings inline en español como
placeholders F2, consistente con el patrón de
`season-hub.tsx`/`semanal.tsx` antes de que se poblaran los
`seasonHub.*` en `copy.ts`. La migración a `t()` queda para
MGC-487.1 (siguiente PR de F3) para evitar 5 archivos de locale en
un solo PR.

## Criterios de aceptación cubiertos

| AC de la spec | Cómo se cubre |
|----------------|---------------|
| Calendario jugable (Step 1) | ya mergeado en MGC-212 |
| Simular partido (Step 2) | ya mergeado en MGC-1650 + `simulation.ts` |
| Tabla posiciones + stats (Step 3) | ya mergeado en MGC-212 + MGC-265 |
| Detección fin fase regular (Step 4) | ya mergeado en `phase.ts` |
| **Resolver playoffs (Step 5)** | **nuevo** `playoff.ts` + UI + 10 tests |
| Empate en playoff → penales | ⚠️ placeholder 50/50 (ver §2) |
| **Rollover fin de año (Step 6)** | **nuevo** `season-rollover.ts` + UI + 5 tests |
| Edge case: tabla < 8 equipos → bye | `playoff.ts` test "padding con BYE" |
| Persistencia snapshot | `flushPendingSave` ya invocado por mutaciones de store |

## Validación

```bash
cd copero
pnpm vitest run src/features/career/playoff.test.ts src/features/career/season-rollover.test.ts
# → 15 tests, todos verdes
pnpm vitest run src/features/career/phase.test.ts
# → 10 tests verdes (no regresiones)
```

### Typecheck

Pre-existe un error de `vite/client` types en main (no introducido
por este PR — ver `analytics.ts` y `SimuladorCarreraFutbolPage.tsx`).
Los archivos nuevos reportan **0 errores TS**.

### QA gate sugerido

Walk manual:
1. Cargar carrera hasta semana 34 (loop actual de MGC-212).
2. Navegar a `/simulador-carrera/playoff` (botón "Playoffs" desde
   `calendar.tsx` — fuera de scope de este PR, queda para MGC-487.1).
3. Tap "Avanzar ronda" tres veces → verificar que aparecen cuartos →
   semis → final → campeón.
4. Tap "Cerrar temporada" → verificar preview de temporada N+1,
   semana 1, edad +1.

## Out of scope (siguientes PRs)

| Ticket | Alcance |
|--------|---------|
| MGC-487.1 | Wire `playoff.tsx` desde `calendar.tsx` (CTA al cerrar semana 34) + i18n `playoff.*` en copy.ts |
| MGC-487.2 | Integrar `match.ts#resolveMatch` con `resolvePlayoffMatch` (reemplazar 50/50 placeholder) |
| MGC-487.3 | Persistir `history[]` desde `season-summary.tsx` (vía `careerStore.applySeasonRollover`) |
| MGC-487.4 | Modal de celebración del campeón (spec Step 5 "campeón con trofeo animado") |
| MGC-487.5 | Wire desde `semanal.tsx` para detectar transición fase regular → playoff |

## Riesgos

1. **Desconexión bracket ↔ match engine**: el bracket usa 50/50
   mientras que `match.ts` pondera por OVR. Riesgo bajo — el seed
   determinista + tests cubren el contrato; mismatch visual sólo se
   nota en QA walk si un sembrado #1 cae en cuartos contra otro top.
2. **`season-summary.tsx` aún no persiste**: el botón "Ir a la nueva
   temporada" navega al hub pero NO bumpea `profile.season` ni
   `history[]`. Esto queda explícito en MGC-487.3.
3. **i18n diferido**: la UI está hardcoded en español. Si QA valida
   en `en` o `pt-BR`, los strings salen mezclados. Documentado en §4.

## Relación con otros flows

- **MGC-463** (umbrella): este PR es el último de los 8 flows
  restantes. Cierra el gap del flow 5/8 (`temporada-loop-5-semanas-playoffs`).
- **MGC-477** (modo-copero): el `CopaBracket` de MGC-497 ya consume
  `RngSnapshot` (ADR-0016). El bracket de playoffs nacionales (este
  PR) es ortogonal — usa el mismo patrón de generador puro + RNG, no
  comparte estado.
- **MGC-481** (restart-limpio): el wipe exhaustivo MGC-215 + el
  back-compat legacy MGC-2606 aplican después del rollover. Sin
  conflicto.

## Referencias

- Spec: `docs/flows/temporada-loop-5-semanas-playoffs/flow.md`
- ADR-0016 (RngSnapshot): `docs/adr/0016-rng-snapshot.md`
- Parent umbrella: `MGC-463` (in_progress)
- Ancestor: `MGC-210` (in_progress)
