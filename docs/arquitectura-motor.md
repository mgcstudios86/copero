# Arquitectura del motor — rev 3 (Fase 2.2)

> **Estado**: rev 3 publicada como work product de MGC-1655 (precheck sobre
> `arquitectura-motor.md` rev 2 + ADR-0016 RNG). Las firmas declaradas en
> §Acción semanal y §Stats están vivas en `src/features/career/{stats,weekly-action}.ts`
> y en `src/types/career.ts` (`affectedAttr`, `startedAtWeek`,
> `severityFor`, `affectedAttrFor`). El review rev 2 del code-reviewer
> sobre MGC-1628 fue aplicado en su totalidad (M1, M2, L1-L4, I1-I3).

## Cambios respecto a rev 2

### MEDIUM

#### M1 — Tipo `Injury` extendido

`src/types/career.ts:65-108`. `Injury` ahora trae dos campos requeridos:

- `affectedAttr: AttributeKey` — atributo del player que la rehabilitación
  amortigua (recibirá `delta / 2` por `applyTrainingDelta` durante la
  rehab). Mapeo determinístico `kind → attr`:

  | `kind`    | `affectedAttr` |
  |-----------|----------------|
  | `ninguna` | `fisico` (placeholder) |
  | `leve`    | `fisico` |
  | `media`   | `mental` |
  | `grave`   | `tecnico` |

  Resuelto por `affectedAttrFor(kind)` (helper canónico exportado desde
  `career.ts`). NO se samplea (la probabilidad de cada `kind` la decide
  el RNG en `injury-v2.ts#maybeRollInjury`); si en F3+ queremos
  condicionar `media` (p.ej. media condicional a OVR < 70), se agrega
  acá sin tocar call sites.

- `startedAtWeek: number` — semana (1-indexed) en que se disparó la
  lesión. Persistido en el save v2. Habilita la regla F3+ de decaimiento
  por tiempo sin rehab (a partir de la semana 4 sin rehab, el delta
  negativo se acumula 1.5×).

Renombre histórico: `weeksRemaining` → `fechasOut` ya estaba aplicado
en rev 2 (MGC-1628 review anterior). Confirmado en §M1 de rev 3.

#### M2 — `positionFactor(position, opponentArchetype?)`

`src/features/career/stats.ts`. Tabla canónica con 12 posiciones × 3
arquetipos (DESARROLLO / EQUILIBRIO / AMBICIÓN):

| Position | DESARROLLO | EQUILIBRIO | AMBICIÓN |
|----------|------------|------------|----------|
| ST       | 1.05       | 1.0        | 0.95     |
| LW/RW    | 1.04       | 1.0        | 0.96     |
| CAM      | 1.03       | 1.0        | 0.97     |
| CM       | 1.01       | 1.0        | 0.99     |
| CDM      | 0.99       | 1.0        | 1.01     |
| LM/RM    | 1.02       | 1.0        | 0.98     |
| CB       | 0.97       | 1.0        | 1.02     |
| LB/RB    | 0.98       | 1.0        | 1.01     |
| GK       | 1.0        | 1.0        | 1.0      |

**Compuesto 1.05 × 1.02 = 1.071** (F2.2 §5): representa el caso límite
"ST vs DESARROLLO + arquero rival AMBICIÓN". Es el techo teórico del
OVR compuesto. Documentado en `reputation.ts#recomputeOvrForPosition`
(JSDoc); el clamp `[0, 99]` lo absorbe antes de cualquier overflow. La
integración real (F3+) thread-ea `opponentArchetype` por el call site;
hoy la firma es estable y los callers existentes siguen funcionando
porque `positionFactor(pos, undefined)` devuelve `1.0`.

### LOW

#### L1 — Firmas de "acción semanal"

`src/features/career/weekly-action.ts`. Tres firmas puras:

```ts
function fatigueDeltaFor(action: WeeklyActionId, rng: Rng): number;
function needsInjuryCheck(action: WeeklyActionId): boolean;
function applyTrainingDelta(
  profile: PlayerProfile,
  action: WeeklyActionId,
  rng: Rng,
): { profile: PlayerProfile; attrs: PlayerProfile['attrs'] };
```

Convenciones:

- **Puras**: sin side-effects, sin acceso al store.
- **Deterministas excepto donde explícitamente reciben `rng`**.
- **`needsInjuryCheck`**: `true` para `M*` (partidos) y `E5`
  (entrenamiento duro); `false` para `L*` (rehab, ya lesionado) y el
  resto. Esta convención la consume `simulation.ts#recommendStrategy`
  en F2.2+.

Las implementaciones son placeholder F2.2 (delegan al RNG con valores
0); la lógica real se cablea en F2.2+ cuando code-reviewer valide la
firma. Aceptable para rev 3 porque sólo necesitamos la forma del
contrato, no la tabla cerrada.

#### L2 — `getSnapshot(): CareerSaveV2`

`src/shared/store/careerStore.ts`. Helper público que proyecta el
estado actual de la Zustand store al shape `v: 2`. Vinculado a:

- `commit()` — cada save v2 emite este shape (a través de
  `snapshotToSave` → `migrateV1ToV2` en `persistence.ts`).
- `loadCareerSave()` — v1 legacy se normaliza a `v: 2` antes de
  hidratar la store.

Nuevo tipo `CareerSaveV2` (`src/types/career.ts:357-364`):
`Omit<CareerSaveState, 'v'> & { v: 2 }`. Migración V1→V2 sólo
normaliza `Injury` saves legacy (rellena `affectedAttr` desde `kind`
vía `affectedAttrFor`, `startedAtWeek` a `0`).

#### L3 — `hasMatchThisWeek(week, action)` 0-indexed

`src/features/career/simulation.ts`. Convención 0-indexed:

- `week = 0` ↔ `profile.week = 1` (primera semana).
- `week = 37` ↔ `profile.week = 38` (última).

Plan de partidos: hay partido en semanas `0, 3, 6, ..., 36` (cada 3
semanas, offset 0). Las semanas `1, 2, 4, 5, ...` son entrenamiento.
Esto corrige el off-by-one del plan original (`week % 3 === 0` con
`week` 1-indexed fallaba en la primera semana). Documentado en el
JSDoc de `advanceWeek` para que futuros helpers 0-indexed tengan la
guía canónica.

#### L4 — `groupOf(position)` en `positions.ts`

`src/features/career/positions.ts:67-91`. Helper canónico exportado
que resuelve `Position → PositionGroup`. Antes la resolución vivía
inline en `match.ts#groupOf` (privado) y se duplicaba en
`engine.ts#pickClub` como un `groupMap` Record literal. Ahora es un
solo switch importable; los call sites consumen la versión exportada.

### INFO

#### I1 — `StandardNormal` (no `kstest`)

`src/features/career/rng.ts` exporta el `Rng` determinista (Mulberry32).
La distribución normal NO se usa en el motor de carrera hoy (sólo
`next()` / `int()` / `chance()`). Si en F3+ queremos introducir
distribuciones no-uniformes (p.ej. drift OVR gaussiano), se importa
`StandardNormal` desde `reputation.ts` o un nuevo módulo `rng-stats.ts`
— NUNCA `kstest`, que es un test estadístico y no una distribución.
El ejemplo de import en rev 2 (§RNG seedeado) está eliminado.

#### I2 — `RngSnapshot` con `v: 1`

Nuevo tipo en `src/features/career/rng.ts`:

```ts
export type RngSnapshot = {
  v: 1;
  seed: number;
  cursor: number;
  algorithm: 'mulberry32';
};
```

El campo `v: 1` es el discriminador de versión. Si en F3+ migramos a
otro PRNG (xoshiro, sfc32), `v` pasa a `2` y agregamos un
`migrateRngV1ToV2` que descarte los snapshots v1 (no son
reproducibles post-migración — un motor nuevo no puede "resumir" desde
un cursor de Mulberry32). Política documentada en `careerStore.ts` §L2.

#### I3 — PROHIBIDO `Math.random()` en `src/features/career/*`

Aplicable a partir de F2.2+. Toda aleatoriedad se inyecta vía `Rng`
(ADR-0016 §Limitaciones).

**Excepción documentada**: `src/features/career/persistence.ts:221`
usa `Math.floor(Math.random() * 1_000_000)` como seed legacy fallback
para saves sin `seed` persistido. Es una rama muerta en práctica (los
saves legacy siempre tienen `seed` post-MGC-227), pero se mantiene
para no romper seeds huérfanos de QA. La línea está marcada con
`// FIXME MGC-1628 I3: reemplazar por seedFromString('legacy-no-seed')`
para que F3+ la cierre.

Política de auditoría (F3+): grep

```sh
grep -rn "Math\.random" src/features/career | grep -v test | grep -v rng.ts
```

debe devolver 0 resultados fuera de `persistence.ts:221` (excepción).

## RNG seedeado (ADR-0016)

Resumen del contrato:

1. Toda función del motor puro (`features/career/*` excepto `tests/`)
   que necesite aleatoriedad recibe un `Rng` por parámetro. NO
   importa `Math.random`, NO lee `globalThis.crypto.getRandomValues`,
   NO usa `Date.now()` como seed.
2. El seed se computa como `hash(profileName) + week * 1009 + season * 31
   + strategyHash`, salvo casos específicos documentados arriba
   (MGC-491 rollover, injury-v2 seed).
3. El snapshot se persiste como `RngSnapshot` (§I2) en el save v2.
4. Acceptance bar #7 de `strategies.md`: QA puede validar feedback
   estable a través de 10 partidas con seed fijo. Si una función no
   respeta el contrato, el grep del §I3 falla y el PR se rechaza.

## Upgrade path F3+

| Bump     | Campos afectados                          | Migración                           |
|----------|-------------------------------------------|-------------------------------------|
| v1 → v2  | `Injury.affectedAttr`, `Injury.startedAtWeek` | `migrateV1ToV2` rellena defaults   |
| Rng v1 → v2 | swap de Mulberry32 por xoshiro/sfc32 | snapshots v1 se descartan (no resumibles) |
| Save v2 → v3 | `currentFatigue`, `lastAction`        | `migrateV2ToV3` agrega defaults     |

## Acceptance criteria (rev 3)

- ✅ Tipo `Injury` extendido y documentado (`affectedAttr`,
  `startedAtWeek`).
- ✅ Firmas `positionFactor`, `fatigueDeltaFor`, `needsInjuryCheck`,
  `applyTrainingDelta`, `getSnapshot` declaradas en código vivo.
- ✅ `groupOf(position)` agregado en `positions.ts`.
- ✅ `hasMatchThisWeek` normalizado a 0-indexed.
- ✅ arquitectura-motor rev 3 publicada.
- ⏳ `tsc --noEmit` verde — pendiente ejecutar.
- ⏳ Tests existentes verdes — pendiente ejecutar.

## Referencias

- MGC-1628: review original (rev 2) sobre arquitectura-motor.md.
- MGC-1629: implementación F2.2 (engine + árbol semanal).
- MGC-1655: este precheck (rev 3).
- ADR-0016 (a crear): RNG seedeado — política global.
- ADR-0017: transfer system (no aplica a este doc).