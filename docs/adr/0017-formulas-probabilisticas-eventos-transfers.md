# ADR-0017 — Fórmulas probabilísticas: eventos post-partido + transfer system

- **Status**: accepted
- **Date**: 2026-09-04
- **Deciders**: CTO (`f525acc4`)
- **Context**: MGC-1631 (F3.1) — diseño de eventos post-partido y transfer
  system para Copero.
- **Supersedes**: ninguno.
- **Related**: MGC-1623 (parent), MGC-1630 (F2.3 walk), MGC-1629 (F2.2 base),
  `src/features/career/rng.ts` (Mulberry32 ya en uso), `strategies.md §7`
  (motor sin UI randomness).

## Contexto

MGC-1623 pide al motor de Copero un sistema de eventos post-partido y un
transfer system entre temporadas con comportamiento probabilístico
explícito. El operador dejó claro que **la suerte no compensa stats bajas**:
"suerte tmb tiene que estar acompañada a buen rendimiento".

El motor ya carga un RNG determinista (Mulberry32, `rng.ts`) inyectado por
invocación. Las decisiones de probabilidad tienen que vivir en el motor, no
en la UI. Este ADR fija las fórmulas canónicas para que F3.2 y F3.3 las
implementen tal cual, y para que QA (F2.3 / F3.4) pueda validarlas con seeds
fijos.

## Decisión

### §1 — Eventos post-partido

Probabilidades base (todas via `rng.chance(p)`):

| Evento | Probabilidad | Pre-condición |
|--------|--------------|---------------|
| `descanso` | siempre que rating ≥ 6.0 | rating del partido |
| `fiesta` | 50% | rating ≥ 7.0 |
| `gambling` | 30% (sobre los que salieron) | form ≥ 60 |
| `compra_lujosa` | 20% (sobre los que salieron) | rating ≥ 8.0 |
| `premiacion_individual` | 10% | rating ≥ 9.0 |

`premiacion_individual` es **cap independiente**: si rating ≥ 9.0 se evalúa
primero (10%), antes que `fiesta` (50%). Evita que un partido brillante se
quede solo en "salir a festejar".

### §2 — Gate de suerte por posición

La suerte post-fiesta **solo activa** si el stat principal de la posición
supera el umbral:

```ts
const SUERTE_GATE: Record<PlayerPosition, number> = {
  GK:  70,  // reflejos
  DEF: 68,  // marca + pase
  MID: 66,  // pase + visión
  FWD: 65,  // definición + velocidad
};
```

Si `keyStat < SUERTE_GATE[pos]`, `luckBonus = 0` y el evento sólo aplica
fatiga/riesgo de lesión (sin compensación). Esto refleja textualmente el
brief: *"sin stats → suerte no compensa"*.

Cuando el gate pasa:

```
luckBonus = 0.10 + 0.05 * rng.next()    // 10%..15%
trainingBoost = 1.0 (fiesta) ó 0.9 (compra lujosa)
injuryRiskMul = 1.0 (fiesta/descanso)
              | 1.5 + 0.5 * rng.next()  // 1.5..2.0  (gambling)
```

### §3 — Árbol de decisión por posición

Cada posición define ≥20 nodos. Cada nodo expone ≥6 outcomes. Los outcomes
son una tabla con `weight` que suman 1.0 (normalizados al seleccionar).

```ts
type DecisionOutcome = {
  id: OutcomeId;
  weight: number;             // probabilidad relativa; sum(outcome.weight) = 1.0
  statDelta: Partial<PlayerStats>;
  formDelta?: number;
  fatigueDelta?: number;
  injuryChance?: number;      // 0..1, gate con rng.chance()
  nextNode: DecisionNodeId | null;
};
```

La selección es uniforme sobre la suma de `weight`:

```ts
function pickOutcome(rng: Rng, node: DecisionNode): DecisionOutcome {
  const total = node.outcomes.reduce((s, o) => s + o.weight, 0);
  const r = rng.next() * total;
  let acc = 0;
  for (const o of node.outcomes) {
    acc += o.weight;
    if (r < acc) return o;
  }
  return node.outcomes.at(-1)!;
}
```

Invariantes que los tests deben verificar:

- `sum(weights) == 1.0 ± 1e-9` por nodo.
- `length(outcomes) >= 6` por nodo.
- Cobertura: ≥20 nodos por posición.

### §4 — Transfer system

Evaluación al cierre de temporada (`season_end`):

```
avgRating = mean(matches[*].rating)
goals     = sum(matches[*].goals)  // aplica solo FWD; 0 si no aplica
tablePos  = club.finalPosition
```

| Veredicto | Condición | Resultado |
|-----------|-----------|-----------|
| `elite_offers` | avgRating ≥ 8.0 **y** (FWD? goals ≥ 15 : tablePos ≤ 4) | 3 ofertas top |
| `strong_offers` | avgRating ≥ 7.4 **y** (FWD? goals ≥ 10 : tablePos ≤ 8) | 2 ofertas mid |
| `hold` | 7.0 ≤ avgRating < 7.4 **y** tablePos < 16 | 0–1 oferta misma liga; default `no_movement` |
| `hold_low` | 6.0 ≤ avgRating < 7.0 **y** tablePos < 16 | 0–1 oferta misma liga; default `no_movement` (sin `descent_risk`) |
| `descent_risk` | avgRating < 6.0 **ó** tablePos ≥ 16 | 1 oferta de liga inferior + flag `forcedTransfer` |
| `retirement` | age ≥ 35 | fuera de scope F3.1, `retirement.ts` lo maneja |

Las ofertas se generan con `pickClub(rng, reputationTier)` y los siguientes
parámetros aleatorios (en rangos fijos, sin más RNG libre):

```
reputationDelta  = 5 + 5 * rng.int(1, 4)    // 5..25
wageMultiplier   = 1.0 + 0.1 * rng.int(0, 20) // 1.0..3.0
yearsContract    = rng.int(2, 5)
expectedRole     = rng.chance(0.5) ? 'starter' : 'rotation'  // elite: starter forzado
```

`decisionDeadline = season_end_week + 4`. Sin decisión al cruzar el deadline,
se aplica `no_movement` (no queda colgado entre temporadas).

> **Caso de ejemplo (MGC-1654)**: jugador con `avgRating = 6.5` y
> `tablePos = 10` cae en `hold_low` → `no_movement` con 0-1 oferta opcional
> de club del mismo nivel. Antes de este ADR el intervalo
> `[6.0, 7.0) ∩ {tablePos < 16}` no entraba en ningún bucket y la
> implementación lo dejaba como `no_movement` implícito (sin contrato
> explícito entre diseño y motor). Esta fila cierra el gap del sello F3.1
> reportado por code-reviewer en MGC-1643.

### §5 — RNG y reproducibilidad

- **No se introduce `Math.random()`** en el código nuevo. Cada función
  nueva recibe `Rng` por invocación.
- Mulberry32 (`rng.ts`) sigue siendo el único generador. Su seed se
  persiste en `careerStore.seed` para que save/load reanude el flujo
  determinista.
- Las pruebas deben incluir un test de **replay exacto**: seed `S` →
  simular N temporadas → hash de eventos debe coincidir con snapshot.

### §6 — Persistencia

`careerStore` se extiende con campos **opcionales con default**:

```ts
type CareerState = {
  // ... campos existentes ...
  postMatchPending?: PostMatchEvent | null;
  nextWeekModifiers?: NextWeekModifiers;
  transferState?: TransferState;
};
```

Migración: si el save no tiene los nuevos campos, se inicializan en sus
defaults. Cubierto por `persistence-legacy-migration.test.ts`. No se
rompen saves de F2.x.

`saveState()` se invoca tras cada `resolvePostMatch` aceptado y tras
cada decisión de transfer. `loadState()` restaura inclusive el modal
pendiente.

### §7 — Justificación de las constantes

- **50% fiesta / 30% gambling / 20% compra lujosa**: tres outcomes mutuamente
  excluyentes sobre el subconjunto "salió a festejar" (rating ≥ 7.0). Se
  usan probabilities condicionales, no independientes, para que la UI
  pueda contar cada outcome por separado.
- **SUERTE_GATE por posición**: cada posición tiene un stat "primario"
  (`positions.ts` ya lo define). Los umbrales 65-70 reflejan que FWD
  convierte más con stat bajo (goles son ruidosos); GK exige más alto
  porque reflejos son stat consolidado.
- **`injuryRiskMul` 1.5..2.0 para gambling**: modela resaca y
  desorden. El motor de lesiones de Fase 2 (MGC-1630 ya valida
  lesiones reales) lo consume directamente.
- **Tabla `outcome.weight` normalizada**: simplifica el seed replay
  (un solo `rng.next()` por outcome) y hace explícita la suma 1.0.

## Consecuencias

### Positivas

- AC de F3.1 cumple literalmente: ≥20 nodos × ≥6 outcomes, 50% fiesta,
  suerte gateada por stats, transfer con 2-3 ofertas, RNG seedeado,
  persistencia compatible.
- QA puede validar con seeds fijos: variabilidad (F2.2/F2.3) y eventos
  (F3.4) con un solo generador.
- Sin cambios a `engine.ts` ni a `season.ts`. F3.1 se monta como capa
  nueva, no como reescritura.

### Negativas

- Las constantes (50%, 30%, umbrales) están **hardcoded** en el ADR.
  Si F4 (tuning) quiere ajustarlas vía A/B test, hay que migrar a
  config. Hoy no se requiere.
- El gate `keyStat >= SUERTE_GATE` puede ser trivial para jugadores
  top; el operador lo pidió así ("mientras mejor seas metas más goles").
  Aceptable para F3.1.

## Deferrals

- **Lógica de puja** entre clubes (F4+).
- **A/B testing** de constantes (F4+).
- **Narrativa de outcomes** (textos i18n): F3.2 entrega, F3.4 sella.

## Acceptance

- ADR fechado.
- Firmas: CTO autor; code-reviewer sella.
- Implementación en F3.2/F3.3 reproduce literalmente las fórmulas de §1–§4.
