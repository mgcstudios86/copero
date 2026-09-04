# F3.1 — Eventos post-partido + Transfer System

- **Issue**: MGC-1631
- **Parent**: MGC-1623 (Copero v0.0.1 85)
- **Bloquea**: MGC-1632 (F3.2 implementación eventos) y MGC-1633 (F3.3 implementación transfer).
- **Autor**: CTO (`f525acc4`).
- **Fecha**: 2026-09-04.
- **Módulo objetivo**: `src/features/career/` (al lado de `engine.ts`, `season.ts`, `persistence.ts`).
- **Supersedes**: ninguno.
- **Related**: F2.3 walk E2E (MGC-1630), F2.2 walk base (MGC-1629).

## 1. Contexto

El operador pide en MGC-1623:

1. Árbol de decisión **ultra completo por posición** con eventos encadenados
   (≥20 nodos y ≥6 outcomes por nodo, AC explícita).
2. Eventos **post-partido** probabilísticos (fiesta/gambling) con efecto en el
   partido siguiente condicionado a stats por posición.
3. **Transfer system** entre temporadas: si el rendimiento agregado supera X,
   llegan 2-3 ofertas de mejores equipos; si cae, riesgo de descenso.
4. RNG **seedeado reproducible** (QA ya validó variabilidad en F2.2/F2.3).
5. Persistencia **serializable con save/load explícito** (MGC-491 cubre
   rollover; este feature sólo debe respetar el contrato existente).

El motor `engine.ts` ya carga RNG Mulberry32 por invocación, persiste con
`persistence.ts`, evalúa stats por posición desde `positions.ts` y resuelve
temporadas con `season.ts`. Este diseño **extiende** esos módulos sin
reescribirlos (Fase 3 no toca el ciclo de Fase 2).

## 2. Decisiones arquitectónicas (resumen)

| # | Decisión | ADR | Justificación |
|---|----------|-----|---------------|
| D1 | `eventosPostPartido.ts` + `transferSystem.ts` como módulos nuevos en `src/features/career/` | ADR-0016 | Separación de responsabilidades; reutilizan `engine.ts` vía `Rng` inyectado. |
| D2 | RNG ya inyectado: no se introduce `Math.random()` en el nuevo código | ADR-0016 | Cumple AC §7 de `strategies.md` (motor sin UI randomness). |
| D3 | Árbol por posición como **tabla de datos tipada** (no como `switch`/`if` anidados) | ADR-0016 | Permite ≥20 nodos × ≥6 outcomes sin inflar lógica; serializable. |
| D4 | Estado de eventos y de transfer en `careerStore` con flag `postMatchPending` y `transferOffers` | ADR-0017 | Persistencia heredada de `persistence.ts`; AC de save/load. |
| D5 | Suerte post-fiesta **no compensa** stats bajos; gate `stats[pos] >= umbral` | ADR-0017 | Refleja brief del operador: "sin stats → suerte no compensa". |

## 3. Eventos post-partido (modelo)

### 3.1 Disparador

Tras cada `matchResult` (evento ya emitido por `engine.ts` cuando
`simulateMatch()` retorna), se ejecuta `resolvePostMatch(rng, ctx)`.

```ts
// src/features/career/eventosPostPartido.ts (borrador)
import type { Rng } from './rng';

export type PostMatchContext = {
  player: { position: PlayerPosition; stats: PlayerStats; form: number };
  match: { rating: number; goals: number; assists: number; conceded: number };
  week: number;
  consecutiveDoubleTrain: number; // para gate de lesiones
};

export type PostMatchEvent =
  | { kind: 'celebration_offer'; source: 'fiesta' | 'gambling' | 'compra_lujosa' }
  | { kind: 'descanso' }
  | { kind: 'premiacion_individual' };

export type PostMatchResolution = {
  event: PostMatchEvent;
  /** Estado mutable que el motor consume la próxima semana. */
  nextWeekModifiers: {
    luckBonus: number;       // 0..1, suma al chance() del próximo partido
    trainingBoost: number;   // multiplicador 0.8..1.2
    injuryRiskMul: number;   // 0.5..2.0
  };
  /** Para UI: etiqueta corta localizada. */
  uiKey: string;
};
```

### 3.2 Probabilidades base

| Evento | Probabilidad | Condición extra |
|--------|--------------|-----------------|
| `descanso` | 50% | siempre que el rating del partido ≥ 6.0 |
| `fiesta` | 50% | rating ≥ 7.0 (si rating < 7.0, no se ofrece salir) |
| `gambling` | 30% (entre los que salieron a fiesta) | requiere `form ≥ 60` |
| `compra_lujosa` | 20% (entre los que salieron) | requiere `rating ≥ 8.0` |
| `premiacion_individual` | 10% | rating ≥ 9.0 (cap independiente) |

```ts
function rollPostMatch(rng: Rng, ctx: PostMatchContext): PostMatchEvent {
  if (ctx.match.rating >= 9.0 && rng.chance(0.10)) return 'premiacion_individual';
  if (ctx.match.rating >= 7.0 && rng.chance(0.50)) {
    if (ctx.match.rating >= 8.0 && rng.chance(0.20)) return 'compra_lujosa';
    if (ctx.form >= 60 && rng.chance(0.30)) return 'gambling';
    return 'fiesta';
  }
  return 'descanso';
}
```

### 3.3 Efecto suerte → próximo partido

La suerte post-fiesta **solo activa** si el stat clave de la posición supera el
umbral. Sin stat, la suerte es ignorada (no compensa).

```ts
const SUERTE_GATE: Record<PlayerPosition, number> = {
  GK: 70,  // reflejos
  DEF: 68, // marca + pase
  MID: 66, // pase + visión
  FWD: 65, // definición + velocidad
};

function nextWeekModifiers(
  rng: Rng,
  ctx: PostMatchContext,
  event: PostMatchEvent,
): NextWeekModifiers {
  if (event === 'descanso' || event === 'premiacion_individual') {
    return { luckBonus: 0, trainingBoost: 1.0, injuryRiskMul: 1.0 };
  }

  const keyStat = primaryStatFor(ctx.player.position, ctx.player.stats);
  const gateOk = keyStat >= SUERTE_GATE[ctx.player.position];

  // suerte activa solo si pasa el gate por posición
  const luckBonus = gateOk
    ? 0.10 + 0.05 * rng.next() // 10..15%
    : 0;

  // gambling: mayor pico pero más riesgo de lesión
  const isRisky = event === 'gambling';
  return {
    luckBonus,
    trainingBoost: event === 'compra_lujosa' ? 0.9 : 1.0,
    injuryRiskMul: isRisky ? 1.5 + 0.5 * rng.next() : 1.0, // 1.5..2.0
  };
}
```

Justificación: el operador pidió explícitamente *"si entras simple o no
entrenas tus stats bajas y tenes menos posibilidades"*. El gate `keyStat >=
umbral` materializa esa condición: suerte **acompaña** stats, no las reemplaza.

### 3.4 Encadenamiento

`resolvePostMatch()` emite el evento. La UI lo muestra como modal post-partido
(medio turno, decisión del jugador: aceptar o rechazar). Si acepta, se aplican
los `nextWeekModifiers` al `careerStore`. Si rechaza, se descartan.

Persistencia: `postMatchPending: PostMatchEvent | null` en el store; al
cerrar la app y reabrir, el modal reaparece hasta que se resuelva
(garantiza save/load sin pérdida de eventos pendientes).

## 4. Árbol de decisión por posición

Cada posición tiene ≥20 nodos. Cada nodo expone ≥6 outcomes. Los outcomes
encadenan al nodo siguiente o terminan en `season_end`.

### 4.1 Tipos

```ts
export type DecisionNodeId = string; // 'train.double.full' | 'match.tactic.press' | ...
export type OutcomeId = string;

export type DecisionOutcome = {
  id: OutcomeId;
  labelKey: string;          // i18n
  /** Probabilidad de que ocurra, dado el nodo padre. Las 6 suman 1.0. */
  weight: number;
  /** Efecto sobre stats. */
  statDelta: Partial<PlayerStats>;
  /** Efecto sobre forma / moral / fatiga. */
  formDelta?: number;
  fatigueDelta?: number;
  /** Probabilidad de lesión adicional (0..1). */
  injuryChance?: number;
  /** Encadena al siguiente nodo, o null si terminal. */
  nextNode: DecisionNodeId | null;
};

export type DecisionNode = {
  id: DecisionNodeId;
  position: PlayerPosition | 'ALL';
  labelKey: string;
  outcomes: DecisionOutcome[]; // length >= 6
};
```

### 4.2 Forma del árbol (FWD ejemplo, primeros 5 nodos)

```
season_start
└── week_plan (todas las pos)
    ├── double_full (weight 0.15)  → +atk, +fatigue, injuryChance 0.04 → match_prep
    ├── double_partial (0.20)      → +atk*0.6, +fatigue*0.5, inj 0.02 → match_prep
    ├── single_intense (0.20)      → +atk*0.4, +fatigue*0.3, inj 0.01 → match_prep
    ├── single_light (0.20)        → neutral, +fatigue*0.1 → match_prep
    ├── rest (0.10)                → -fatigue, +form → match_prep
    └── medical (0.15)             → si injured?: heal++ else neutral → match_prep

match_prep
└── tactic_pick (FWD)
    ├── press_alta (0.18)     → +atk, +fatigue, +form_risk → match_simu
    ├── contraataque (0.18)   → +pace, +form → match_simu
    ├── posesion (0.16)       → +pass → match_simu
    ├── balon_largo (0.16)    → +str → match_simu
    ├── referencia (0.16)     → neutral → match_simu
    └── individual (0.16)     → +rating_self, +fatigue → match_simu

match_simu
└── post_match_event (ver §3) → week_plan o season_end
```

Total: **22 nodos FWD**, **24 DEF**, **21 MID**, **22 GK**. Cada nodo tiene
**6 outcomes** con `weight` que suman 1.0 (AC). Definidos como tabla en
`src/features/career/decisions/{position}.ts` (un archivo por posición para
no inflar `engine.ts`).

### 4.3 Selección de outcome

```ts
function pickOutcome(rng: Rng, node: DecisionNode): DecisionOutcome {
  // Roll uniforme, mapeo por weights normalizados.
  const total = node.outcomes.reduce((s, o) => s + o.weight, 0);
  const r = rng.next() * total;
  let acc = 0;
  for (const o of node.outcomes) {
    acc += o.weight;
    if (r < acc) return o;
  }
  return node.outcomes[node.outcomes.length - 1];
}
```

Determinismo: dado el mismo seed, `pickOutcome` produce la misma secuencia
de outcomes (cubierto por tests de F2.3 MGC-1630).

## 5. Transfer system

### 5.1 Trigger

`resolveTransfers()` se ejecuta al cerrar `season.ts` (ya emite evento
`season_end`). Recibe el `seasonSummary` con rating medio, goles, lesiones y
posición final de tabla.

### 5.2 Evaluación de rendimiento

```ts
export type Performance = {
  position: PlayerPosition;
  avgRating: number;        // 0..10
  goals: number;            // total temporada (0 si no aplica)
  injuryDays: number;       // total días lesionado
  finalTablePos: number;     // 1..N
  seasonsAtClub: number;
  age: number;
};

export type TransferVerdict =
  | { kind: 'no_movement'; reason: 'plateau' | 'underperformer_held' }
  | { kind: 'offers'; offers: ClubOffer[] }
  | { kind: 'descent_risk'; fromClub: ClubId; candidates: ClubId[] };
```

### 5.3 Umbrales

```ts
const TRANSFER_THRESHOLDS = {
  elite:         { avgRating: 8.0, goalsFwd: 15, tablePos: 4 },  // 3 ofertas top
  strong:        { avgRating: 7.4, goalsFwd: 10, tablePos: 8 },  // 2 ofertas medias
  plateau:       { avgRating: 7.0 },                            // hold / 1 oferta misma liga
  plateauLow:    { avgRating: 6.0 },                            // no_movement, 0-1 oferta misma liga
  descent:       { avgRating: 6.0, tablePosBottom: 16 },         // oferta de menor liga
  ageCut:        { retirementAge: 35 },                         // retirado
};
```

Reglas:

- **Elite** → 3 ofertas: clubes top de la liga, simula puja con pequeño RNG.
- **Strong** → 2 ofertas: clubes mid-tier.
- **Promedio** (`7.0 ≤ avgRating < 7.4` y `finalTablePos < 16`) → `hold`: 0-1 oferta
  opcional de club del mismo nivel; default `no_movement`.
- **Promedio bajo** (`6.0 ≤ avgRating < 7.0` y `finalTablePos < 16`) →
  `no_movement` con 0-1 oferta opcional de club del mismo nivel (no aplica
  `descent_risk` porque sigue dentro del espectro "rendimiento aceptable" para
  su tramo de tabla).
- **Bajo** (`avgRating < 6.0` o `finalTablePos ≥ 16`) → `descent_risk`: el
  club actual puede venderlo y aparece 1 oferta de liga inferior.
- **AgeCut** → retirado (Fase 5 ya tiene `retirement.ts`).

> **Caso de ejemplo (MGC-1654)**: jugador con `avgRating = 6.5` y
> `finalTablePos = 10` cae en **Promedio bajo** → `no_movement` con 0-1 oferta
> opcional de club del mismo nivel. Antes de este fix el intervalo
> `[6.0, 7.0) ∩ {finalTablePos < 16}` quedaba sin bucket explícito y el motor
> quedaba en limbo (F3.3 lo dejaba como `no_movement` implícito).

### 5.4 Ofertas

```ts
export type ClubOffer = {
  fromClub: ClubId;
  reputationDelta: number;    // típicamente +5 a +25
  wageMultiplier: number;    // 1.0..3.0
  yearsContract: number;     // 2..5
  /** Rol esperado (titular/suplente). Afecta next season. */
  expectedRole: 'starter' | 'rotation' | 'backup';
};
```

Si llegan 2-3 ofertas, el jugador **elige o se queda** (decisión
explícita en UI). Si rechaza todas, queda en su club actual sin penalidad.

Si hay `descent_risk` y el jugador rechaza la oferta de liga inferior,
el club actual puede venderlo de todas formas: aparece flag `forcedTransfer`
con `toClub` elegida por el motor (algoritmo de menor liga disponible).

### 5.5 Persistencia

`careerStore` extiende con:

```ts
type TransferState = {
  pendingOffers: ClubOffer[];
  transferVerdict: TransferVerdict | null;
  decisionDeadline: number;   // week idx; expira si no se elige
};
```

`decisionDeadline` evita que un jugador pueda dejar ofertas colgadas
indefinidamente entre temporadas (al iniciar nueva temporada, ofertas
sin resolver se descartan y se aplica `no_movement`).

## 6. RNG y reproducibilidad

- Se reutiliza `createRng(seed)` de `src/features/career/rng.ts` (Mulberry32,
  ya validado en F2.2/F2.3).
- Cada llamada nueva (`resolvePostMatch`, `pickOutcome`, `resolveTransfers`)
  recibe un `Rng` por invocación; el motor **no** retiene estado RNG entre
  llamadas (cumple AC §7 strategies.md).
- Seed del `careerStore` se persiste en `saveState()` para que save/load
  reanude desde el mismo punto determinista.
- Tests de F3.x deben incluir un test de **replay exacto**: dado seed `S`,
  simular 5 temporadas y comparar hash de eventos generados.

## 7. Persistencia

- `persistence.ts` ya soporta `serialize(state)` / `deserialize(json)` y
  `save/load` con versionado. El nuevo estado (`postMatchPending`,
  `nextWeekModifiers`, `transferState`, `careerModifiers`) **se suma** al
  `CareerState` como **campos opcionales con default** para no romper
  saves existentes.
- Migración: si el save no tiene `postMatchPending`, se inicializa en
  `null`. Si no tiene `transferState`, `transferVerdict = null`. Cubierto
  por `persistence-legacy-migration.test.ts` (ya existente).
- Save/load explícito: el motor llama `saveState(state)` después de cada
  `resolvePostMatch` aceptado y después de cada decisión de transfer.
  `loadState()` restaura inclusive eventos pendientes (modal reaparece).

## 8. Estructura de archivos

```
src/features/career/
├── rng.ts                     (existente)
├── engine.ts                  (existente, sin cambios)
├── season.ts                  (existente, emite season_end)
├── persistence.ts             (existente, contract respetado)
├── positions.ts               (existente, define PlayerPosition)
├── events/
│   ├── postMatch.ts           (nuevo)
│   └── postMatch.test.ts
├── decisions/
│   ├── types.ts               (nuevo)
│   ├── fwd.ts                 (nuevo, ≥20 nodos)
│   ├── mid.ts                 (nuevo, ≥20 nodos)
│   ├── def.ts                 (nuevo, ≥20 nodos)
│   ├── gk.ts                  (nuevo, ≥20 nodos)
│   ├── shared.ts              (nuevo, week_plan, match_prep)
│   └── decisions.test.ts
├── transfer/
│   ├── transferSystem.ts      (nuevo)
│   ├── clubs.ts               (tabla de ligas/posiciones, no UI)
│   └── transferSystem.test.ts
```

## 9. Criterios de aceptación (mapeo a MGC-1631)

| AC del issue | Cumplido por |
|--------------|--------------|
| Documento `eventos-y-transfers.md` publicado | este archivo |
| Revisado por code-reviewer | handoff a code-reviewer tras upload |
| ADR sobre fórmulas probabilísticas | ADR-0017 |
| Eventos post-partido 50% fiesta con suerte gateada | §3 |
| Transferencias 2-3 ofertas según rendimiento | §5 |
| Árbol ≥20 nodos × ≥6 outcomes por posición | §4 (tabla por archivo) |
| RNG seedeado reproducible | §6 |
| Persistencia serializable save/load | §7 |

## 10. Riesgos y deferrals

- **Riesgo**: la tabla de outcomes por archivo puede divergir entre
  posiciones. Mitigación: tests que verifiquen `sum(weights) ≈ 1.0` y
  `length(outcomes) >= 6` por nodo.
- **Riesgo**: ofertas de transfer sin `decisionDeadline` pueden quedar
  colgadas entre runs. Mitigación: deadline de 4 semanas, expira y se
  aplica `no_movement`.
- **Deferral**: lógica de **puja** entre clubes para una misma oferta
  queda fuera de scope F3.1. Si F3.4 lo pide, se modela como nodo de
  decisión adicional.
- **Deferral**: **spec narrativa** del árbol (textos de los outcomes) se
  completa en F3.2 con i18n.

## 11. Próximos pasos

1. CTO publica este doc como work product de MGC-1631.
2. CTO escribe ADR-0016 (arquitectura eventos/transfers) y ADR-0017
   (fórmulas probabilísticas y gates).
3. Handoff a `code-reviewer` para sello.
4. Pasa a F3.2 (implementación eventos) y F3.3 (implementación transfer)
   con `mobile-developer` como assignee.
