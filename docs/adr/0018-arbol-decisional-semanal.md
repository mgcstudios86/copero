# ADR-0018 — Árbol decisional semanal completo por línea (MGC-1623-G2)

- **Status**: accepted
- **Date**: 2026-09-04
- **Deciders**: CTO (`f525acc4`)
- **Context**: MGC-1623-G2 — feedback operador: "el árbol de desición
  tiene que ser ultra completo por cada posición". El motor ya tiene
  `position-tree.ts` (F2.2, opciones semanales + 4 outcomes posicionales)
  y `social-events.ts` (F4, 4 outcomes post-partido). Falta el módulo
  **integrador** que el operador pueda atravesar de punta a punta:
  decisión semanal → partido → evento social → próxima semana, con
  lesión por sobrecarga y performance modulada por stat.
- **Supersedes**: ninguno.
- **Related**: MGC-1623 (parent), MGC-1629 (F2.2 base),
  MGC-1632 (F3.2 events/transfers/decision-tree), MGC-1674 (PR-414
  `positionalTrainingDelta`), MGC-1738 (MGC-1762 PR-438 social-events),
  ADR-0017 §1-§5, ADR-0016 (RNG Mulberry32),
  `src/features/career/decision-tree.ts` (F3.2 árbol contextual).

## Contexto

MGC-1623-G2 pide explicitamente que el árbol semanal sea **ultra
completo** por línea. Las palancas concretas que el operador enumeró:

| Palanca | Comportamiento esperado |
|---|---|
| Entrenar doble turno | suben stats (resistencia + stat posicional principal) |
| Entrenar turno simple | suben stats chicos pero consistentes |
| Sin entrenar / descanso | stats se mantienen o bajan marginalmente |
| Sobrecarga (doble turno acumulado) | probabilidad de lesión crece con la racha |
| Stats altas | rinde más en partido (goles/atajadas/defensa) |
| Stats bajas | menos chances en partido |
| Evento vida social (timba con amigos post-partido) | afecta la semana siguiente con probabilidad, modulada por stats |
| Sin entrenar | stats bajan → menos chances en partido |

Hasta ahora esos efectos están repartidos en **tres** módulos:

1. `position-tree.ts` (F2.2, MGC-1629) — opciones semanales y árbol
   posicional contextual (8 nodos × ≥4 outcomes por posición). Cubre
   palanca 1, 2, 4, 5 parcialmente.
2. `events.ts` (F3.2, MGC-1632) — eventos post-partido y suerte
   gateada por stat. Cubre palanca 7 parcialmente.
3. `social-events.ts` (F4, MGC-1762) — 4 outcomes sociales
   (timba/asado/tour/quedarse). Cubre palanca 7.

Falta el **módulo integrador** que, dada una línea (GK/DEF/MID/FWD) y
una elección semanal, devuelve el **delta completo** de la semana
(stats + fatiga + chance de lesión + chance de evento social +
modificador de performance para el próximo partido). Este módulo es el
que la UI semanal consume y el que QA valida con seed fijo.

## Decisión

### §1 — Líneas y choice set

El árbol opera sobre `PositionGroup` (no las 12 posiciones individuales
del field map). Las cuatro líneas son:

```
GK | DEF | MID | FWD
```

Esto replica el nivel de granularidad del brief del operador
("delantero, mediocampista, defensor, arquero") y mantiene paridad con
`STATS_BY_GROUP`, `KEY_STAT_BY_GROUP` y `SUERTE_GATE` ya definidos en
`events.ts` y `position-stats.ts`.

`WeeklyChoiceId` (8 choices, union cerrada):

```ts
type WeeklyChoiceId =
  | 'descanso'                      // palanca 3 — recovery puro
  | 'turno_simple'                  // palanca 2
  | 'doble_turno'                   // palanca 1
  | 'rehabilitacion'                // gate: requiere lesión activa
  | 'entrenamiento_mental'          // sube moral + stat aleatorio
  | 'entrenamiento_fisico_especifico' // sube stat posicional concreto
  | 'fiesta_post_partido'           // palanca 7 — evento social
  | 'lesion_activa';                // gate: forzado cuando hay lesión
```

`fiesta_post_partido` y `lesion_activa` se modelan como nodos del árbol
porque el operador pidió que **formen parte del recorrido semanal**, no
efectos secundarios sueltos. La UI los invoca cuando corresponde.

### §2 — Estructura del árbol por línea

Cada línea expone un `WeeklyDecisionTree` data-only:

```ts
type WeeklyDecisionNode = {
  id: WeeklyChoiceId;
  /** copyId que la UI resuelve contra `COPY[locale].weeklyDecision`. */
  copyId: string;
  /** Stats posicionales que se mueven si éxito. */
  statDelta: Partial<Record<StatKey, number>>;
  /** Deltas V1 al `PlayerProfile.career`. */
  careerDelta: {
    fisico: number;       // fatiga: positivo = recupera, negativo = cuesta
    moral: number;
    confianza: number;
  };
  /** Chance base 0..1 de lesión por sobrecarga (sin streak ni fatigue). */
  injuryBase: number;
  /** Multiplicador sobre `injuryBase` por cada semana de racha doble. */
  injuryStreakMul: number;
  /** Chance 0..1 de disparar `fiesta_post_partido` (timba). */
  partyChance: number;
  /** Performance modifier 0..1 que se aplica al próximo partido si el
   *  stat principal de la línea supera `PERF_GATE[pos]`. */
  performanceBoost: number;
};

type WeeklyDecisionTree = {
  group: PositionGroup;
  statGate: number;             // copia local de `SUERTE_GATE[group]`
  perfGate: number;             // umbral de stat para performance boost
  nodes: Record<WeeklyChoiceId, WeeklyDecisionNode>;
};
```

`injuryBase` y `injuryStreakMul` se **combinan** con la fatiga V1 y el
`doubleShiftStreak` que ya calcula `injury-v2.ts`. Ver §3.

### §3 — Fórmula de lesión por sobrecarga

La chance efectiva de lesión semanal se compone con `injury-v2.ts`:

```
injuryProbability(perfil, racha) = base + fatigaMod * 0.35 + rachaMod * 0.25
```

donde `fatigaMod` y `rachaMod` son los scores ya implementados en
`injury-v2.ts` (`fatigueInjuryMod`, `doubleStreakInjuryMod`). El nuevo
módulo aporta un **factor de carga por choice** que modula esa base:

```
cargaChoice = node.injuryBase + node.injuryStreakMul * rachaDobleTurno
cargaChoice = clamp(cargaChoice, 0, 1)
```

donde `rachaDobleTurno` es el número de semanas consecutivas en que el
jugador eligió `doble_turno` (no se incrementa con `turno_simple`).

El producto final:

```
p_lesion_final = clamp(
  INJURY_BASE_RATE + fatigueMod * 0.35 + rachaMod * 0.25
  + cargaChoice * 0.20,                       // contribución del choice
  0, 1
)
```

El **0.20** del choice refleja el principio del operador: la sobrecarga
*contribuye* a la lesión pero **no es frecuente**. La base 0.02 y los
0.35/0.25 de fatiga/racha siguen dominando en la mayoría de los casos.

`INJURY_BASE_RATE` y los modificadores de `injury-v2.ts` se mantienen
tal cual — el ADR no los reescribe, sólo los complementa con el factor
del choice.

### §4 — Performance modifier por stat

El operador pide: "mientras mejor seas metas más goles o atajes mejor
o defiendas mejor". El módulo define:

```ts
const PERF_GATE: Record<PositionGroup, number> = {
  goalkeeper: 75,  // reflejos alto = más atajadas
  defense:     72,  // marcaje/anticipación alto = más duelos ganados
  midfield:    70,  // pase/visión alto = más chances creadas
  attack:      68,  // definición/velocidad alto = más goles
};
```

Si el **promedio de los 4 stats** de la línea supera `PERF_GATE`, se
aplica `node.performanceBoost` al próximo partido. El boost se consume
dentro de `applyWeeklyDecision` y se traduce a un
`PerformanceModifier` que `resolveWeeklyMatch` (F2.3) lee:

```
PerformanceModifier {
  goalChanceMul: number;       // FWD: chance de convertir
  saveChanceMul: number;       // GK: chance de atajar
  defenseChanceMul: number;     // DEF: chance de ganar duelo
  creationChanceMul: number;    // MID: chance de pase/asistencia
}
```

Cada línea tiene su propio multiplicador `>0`. Si el promedio **no**
supera `PERF_GATE`, los multiplicadores quedan en `1.0` (neutral). Si
el promedio **baja de** `PERF_GATE * 0.6` (umbral de penalización),
los multiplicadores bajan a `0.85` (stat-baja reduce chances). Esa es
la palanca 8 del brief.

### §5 — Party: evento social modulado por stat

`fiesta_post_partido` se evalúa al cierre del partido con la misma
lógica que `social-events.ts` (PR-438): si el rating del partido ≥
6.5 y `rng.chance(node.partyChance * node.partyStatGateMul)`, se
dispara un evento social cuyas consecuencias se aplican a la semana
siguiente (delegado a `runSocialEvent`).

`partyStatGateMul` vale `1.0` cuando el stat principal pasa el gate de
suerte de `events.ts` (`SUERTE_GATE[group]`), y `0` cuando no. Eso
materializa textualmente el brief "sin stats → la suerte no compensa":
el evento se rolea igual, pero el multiplicador es 0 y el jugador sólo
paga el costo de fatiga/lesión.

### §6 — Por qué un módulo nuevo (no extender `position-tree.ts`)

Misma justificación que `decision-tree.ts` (F3.2, MGC-1632 ADR-0017
§3) y `social-events.ts` (F4, MGC-1762):

1. `position-tree.ts` está cerrado por contrato de F2.2 — `PositionTree`
   / `PositionOutcome` validan una tupla de **exactamente 4 outcomes**
   por nodo (`fase2-arbol.test.ts`). Insertar 8 choices rompería el AC.
2. `decision-tree.ts` está cerrado por ADR-0017 §3 — `DecisionNode` /
   `DecisionOutcome` validan **exactamente 6 outcomes** (`fase3-events-
   transfers.test.ts`). Insertar performance modifiers rompería el AC.
3. `social-events.ts` está cerrado por MGC-1762 — `SocialEvent` tiene
   **exactamente 4 outcomes** disjuntos (timba/asado/tour/quedarse).
   Insertar performance/lesión rompería el AC.

`weeklyDecisionTree.ts` opera a **otro nivel de abstracción**: integra
los tres módulos anteriores como una **capa semanal** que la UI consume
de punta a punta, sin tocar los contratos cerrados de F2.2/F3.2/F4.
Esto preserva el principio "no rompas ACs viejas para hacer features
nuevas".

### §7 — Datos por línea (las 4 tablas)

Cada tabla resume `statDelta` por choice. Los números se justifican en
§8. `careerDelta.fisico` sigue el patrón V1 (positivo = recupera).

#### GK — `goalkeeper`

| Choice | statDelta | careerDelta (fisico/moral/conf) | injuryBase | injuryStreakMul | partyChance | perfBoost |
|---|---|---|---|---|---|---|
| `descanso` | {} | +20 / -2 / 0 | 0 | 0 | 0.05 | 0 |
| `turno_simple` | {reflejos:1, posicionamiento:1} | -5 / +1 / 0 | 0.01 | 0 | 0.10 | 0.08 |
| `doble_turno` | {reflejos:2, manos:1, posicionamiento:1} | -15 / +5 / +2 | 0.04 | 0.06 | 0.20 | 0.15 |
| `rehabilitacion` | {} | +8 / 0 / 0 | 0 | 0 | 0 | 0 |
| `entrenamiento_mental` | {posicionamiento:1} | -2 / +6 / +1 | 0 | 0 | 0.05 | 0.04 |
| `entrenamiento_fisico_especifico` | {reflejos:2} | -10 / +2 / +1 | 0.03 | 0 | 0.10 | 0.10 |
| `fiesta_post_partido` | {} | -8 / +6 / +2 | 0.02 | 0 | 1.0 | 0 |
| `lesion_activa` | {} | -5 / -4 / -2 | 0.06 | 0 | 0 | -0.10 |

#### DEF — `defense`

| Choice | statDelta | careerDelta | injuryBase | injuryStreakMul | partyChance | perfBoost |
|---|---|---|---|---|---|---|
| `descanso` | {} | +20 / -2 / 0 | 0 | 0 | 0.05 | 0 |
| `turno_simple` | {marcaje:1, anticipacion:1} | -5 / +1 / 0 | 0.01 | 0 | 0.10 | 0.08 |
| `doble_turno` | {marcaje:2, cabeceo:1, resistencia:1} | -15 / +5 / +2 | 0.04 | 0.06 | 0.20 | 0.15 |
| `rehabilitacion` | {} | +8 / 0 / 0 | 0 | 0 | 0 | 0 |
| `entrenamiento_mental` | {anticipacion:1} | -2 / +6 / +1 | 0 | 0 | 0.05 | 0.04 |
| `entrenamiento_fisico_especifico` | {marcaje:2} | -10 / +2 / +1 | 0.03 | 0 | 0.10 | 0.10 |
| `fiesta_post_partido` | {} | -8 / +6 / +2 | 0.02 | 0 | 1.0 | 0 |
| `lesion_activa` | {} | -5 / -4 / -2 | 0.06 | 0 | 0 | -0.10 |

#### MID — `midfield`

| Choice | statDelta | careerDelta | injuryBase | injuryStreakMul | partyChance | perfBoost |
|---|---|---|---|---|---|---|
| `descanso` | {} | +20 / -2 / 0 | 0 | 0 | 0.05 | 0 |
| `turno_simple` | {pase:1, vision:1} | -5 / +1 / 0 | 0.01 | 0 | 0.10 | 0.08 |
| `doble_turno` | {pase:2, vision:1, resistencia:1} | -15 / +5 / +2 | 0.04 | 0.06 | 0.20 | 0.15 |
| `rehabilitacion` | {} | +8 / 0 / 0 | 0 | 0 | 0 | 0 |
| `entrenamiento_mental` | {vision:1} | -2 / +6 / +1 | 0 | 0 | 0.05 | 0.04 |
| `entrenamiento_fisico_especifico` | {pase:2} | -10 / +2 / +1 | 0.03 | 0 | 0.10 | 0.10 |
| `fiesta_post_partido` | {} | -8 / +6 / +2 | 0.02 | 0 | 1.0 | 0 |
| `lesion_activa` | {} | -5 / -4 / -2 | 0.06 | 0 | 0 | -0.10 |

#### FWD — `attack`

| Choice | statDelta | careerDelta | injuryBase | injuryStreakMul | partyChance | perfBoost |
|---|---|---|---|---|---|---|
| `descanso` | {} | +20 / -2 / 0 | 0 | 0 | 0.05 | 0 |
| `turno_simple` | {definicion:1, velocidad:1} | -5 / +1 / 0 | 0.01 | 0 | 0.10 | 0.08 |
| `doble_turno` | {definicion:2, regate:1, velocidad:1} | -15 / +5 / +2 | 0.04 | 0.06 | 0.20 | 0.15 |
| `rehabilitacion` | {} | +8 / 0 / 0 | 0 | 0 | 0 | 0 |
| `entrenamiento_mental` | {velocidad:1} | -2 / +6 / +1 | 0 | 0 | 0.05 | 0.04 |
| `entrenamiento_fisico_especifico` | {definicion:2} | -10 / +2 / +1 | 0.03 | 0 | 0.10 | 0.10 |
| `fiesta_post_partido` | {} | -8 / +6 / +2 | 0.02 | 0 | 1.0 | 0 |
| `lesion_activa` | {} | -5 / -4 / -2 | 0.06 | 0 | 0 | -0.10 |

### §8 — Justificación de las constantes

- **`statDelta` magnitudes (1..2)**: mismo orden que el árbol F2.2
  (`position-tree.ts:71`); un doble turno sube 2 puntos del stat
  principal y 1 de un secundario. Razón: 1 statPoint/semana es ritmo
  razonable para 30+ semanas de carrera.
- **`injuryBase` 0.04 para `doble_turno`**: 4% base sin streak ni
  fatiga. Sigue siendo "no frecuente" — el operador dijo
  explícitamente "que no sea frecuente". El factor 0.06 de
  `injuryStreakMul` hace que con racha de 4+ semanas la chance suba a
  ~0.28 sin contar fatiga, lo que **se siente** sin ser catastrófico.
- **`partyChance` 0.20 base + `partyStatGateMul`**: 20% dispara evento
  social cuando stats pasan el gate. Cuando no pasa el gate, el
  multiplicador es 0 — el evento se rolea pero no compensa. Idéntico
  al principio de `events.ts` §2.
- **`PERF_GATE` más alto que `SUERTE_GATE`**: el boost de performance
  exige stats de elite (75/72/70/68 vs 70/68/66/65). Razón: el
  operador pidió "mientras mejor seas" — el boost debe ser
  significativo, no trivial.
- **`performanceBoost` 0.15 para doble turno**: traducido a
  PerformanceModifier, FWD pasa de 1.0 → 1.15 en `goalChanceMul`. GK
  DEF MID análogos. Es un 15% adicional de chance — visible en
  partido sin romper el balance.
- **`lesion_activa` performanceBoost -0.10**: cuando el promedio está
  muy por debajo del umbral de penalización (`PERF_GATE * 0.6`), el
  modificador cae a 0.85x. Cubre textualmente "sin entrenar stats
  bajan → menos chances".

### §9 — RNG y reproducibilidad

- **No se introduce `Math.random()`** en el código nuevo. Cada función
  nueva recibe `Rng` por invocación.
- Mulberry32 (`rng.ts`) sigue siendo el único generador. Su seed se
  persiste en `careerStore.seed` para save/load determinista.
- Las pruebas incluyen un test de **replay exacto**: seed `S` →
  simular N semanas → hash de `(choice, outcome, modifier)` debe
  coincidir con snapshot.

### §10 — API pública (resumen)

```ts
// Lookup
getWeeklyTree(group: PositionGroup): WeeklyDecisionTree
getWeeklyNode(group, choiceId): WeeklyDecisionNode | null

// Effects
injuryProbabilityForChoice(profile, doubleShiftStreak, group, choiceId): number
performanceModifierFor(group, position, stats, choiceId): PerformanceModifier
partyChanceForChoice(group, choiceId, positionStats): { chance, gatePassed }
applyWeeklyDecision(profile, group, choiceId, rng): WeeklyDecisionResult
```

`WeeklyDecisionResult` agrega:

```ts
type WeeklyDecisionResult = {
  group: PositionGroup;
  choiceId: WeeklyChoiceId;
  newStats: PositionStats;
  newCareer: PlayerProfile['career'];
  injuryProbability: number;     // efectiva (combinada)
  partyChance: number;
  partyGatePassed: boolean;
  performance: PerformanceModifier;
  rngSnapshot: RngSnapshot;
};
```

## Consecuencias

### Positivas

- AC de MGC-1623-G2 cumple literalmente: 4 líneas × 8 choices =
  32 nodos; cada nodo tiene los 5 efectos pedidos
  (statDelta/lesión/party/performance/recovery).
- QA puede validar variabilidad (F2.2/F2.3), eventos (F3.2) y social
  (F4) con un solo recorrido, usando seed fijo.
- Sin cambios a `position-tree.ts` ni `decision-tree.ts` ni
  `social-events.ts`. F-G2 se monta como capa nueva, no como
  reescritura.
- El módulo se integra como **integrador**: `applyWeeklyDecision`
  llama a `applyStatDeltas`, `runSocialEvent` (MGC-1762) y
  `maybeRollInjury` (F2.2) sin duplicar lógica.

### Negativas

- Las constantes (4% injuryBase, 0.06 streak, 75 PERF_GATE) están
  hardcoded en el ADR. Si F-tuning quiere ajustarlos vía A/B test, hay
  que migrar a config. Hoy no se requiere.
- El módulo agrega una capa más al recorrido semanal. Mitigación: la
  UI sigue consumiendo la misma signature (`WeeklyBaseOptionId`); el
  nuevo módulo es **interno al motor**, no expone nuevos ids al UI.

## Deferrals

- **A/B testing** de constantes (F-tuning+).
- **Performance modifier** que afecte también `moral`/`confianza`
  durante el partido (F5+).
- **Tuning por liga**: PERFORMANCE_BOOST diferenciado entre ligas
  top/mid/low (F-tuning+).

## Acceptance

- ADR fechado.
- Firmas: CTO autor; code-reviewer sella.
- Implementación en `weeklyDecisionTree.ts` reproduce literalmente
  las tablas de §7 y la fórmula de §3-§4-§5.
- Tests cubren:
  - 1 caso por línea × 5 categorías (rest/simple/double/party/injury).
  - Doble turno acumulado dispara lesión con seed fijo.
  - Party modula rendimiento (gate pasa / no pasa).
  - Stat-baja reduce chances (performanceModifier cae a 0.85x).
  - Performance sim F2 + F3 sigue verde (regresión).