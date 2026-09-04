/**
 * Motor de simulación del simulador-carrera (MGC-442).
 *
 * Pure functions. Estado inmutable. Consume el catálogo `strategy.ts` por
 * ID y devuelve `SimulationEvent` que la UI renderiza con copy desde
 * `src/design/copy/es-AR/simulador-carrera.ts`.
 *
 * Acceptance bar de strategies.md §7:
 * 1. Cada decision tiene ID único (E1, M2, T1, L3, R2, O4, V7).
 * 2. Condición evaluable en estado puro.
 * 3. Opciones enumeradas + feedback por opción.
 * 4. Probabilidad numérica o función determinista.
 * 5. Stats son inmutables por decisión (la UI no los modifica).
 * 6. Reputación se recalcula como pure function.
 * 7. Eventos (V*) tienen disparador explícito.
 * 8. Motor devuelve `{event, choices, consequences[]}` sin UI.
 *
 * F2.3 (MGC-1657) — suma `applyWeeklyChoice` que conecta los módulos
 * puros de F2.2 (`getPositionTree`, `applyStatDeltas`, `maybeRollInjury`)
 * con el state machine V1. Reemplaza las opciones semanales V1 (E1..E5)
 * por `WEEKLY_BASE_OPTIONS` (6 opciones data-only con árbol posicional
 * ≥8 nodos × ≥4 outcomes). Back-compat: `applyChoice` V1 sigue
 * funcionando intacto para tests heredados.
 */

import {
  createRng,
  createRngFromSnapshot,
  createRngSnapshot,
  seedFromString,
  snapshotRng,
  type Rng,
  type RngSnapshot,
} from './rng';
import { recomputeOvrForPosition, recomputeReputation } from './reputation';
import {
  EVENT_STRATEGIES,
  MATCH_STRATEGIES,
  STRATEGIES,
  WEEKLY_STRATEGIES,
  type StatDelta,
} from './strategy';
import type {
  Attributes,
  CareerStats,
  Choice,
  Consequence,
  FeedbackPayload,
  FeedbackTone,
  Injury,
  InjuryKind,
  PlayerProfile,
  SimulationEvent,
  StrategyId,
} from '@/types/career';
import { affectedAttrFor } from '@/types/career';
import {
  STAT_INIT,
  applyStatDeltas,
  type PositionStats,
  type StatKey,
} from './position-stats';
import {
  WEEKLY_BASE_OPTIONS,
  getPositionTree,
  type PositionOutcome,
  type WeeklyBaseOption,
  type WeeklyBaseOptionId,
} from './position-tree';
import { maybeRollInjury, isInjured as isInjuredV2 } from './injury-v2';
import { resolveMatch, type MatchOutcome } from './match';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const toneForStat = (field: string, delta: number): FeedbackTone => {
  if (delta === 0) return 'neutral';
  if (field === 'fisico' && delta < 0) return 'warning';
  if (field === 'moral' && delta < 0) return 'danger';
  return delta > 0 ? 'success' : 'warning';
};

/** Aplica StatDeltas inmutablemente sobre CareerStats + Attributes. */
export function applyDeltas(
  career: CareerStats,
  attrs: Attributes,
  deltas: StatDelta[],
): { career: CareerStats; attrs: Attributes } {
  const next: CareerStats = { ...career, reputation: { ...career.reputation } };
  const nextAttrs: Attributes = { ...attrs };

  for (const { field, delta } of deltas) {
    switch (field) {
      case 'moral':
        next.moral = clamp(next.moral + delta, 0, 100);
        break;
      case 'fisico':
        next.fisico = clamp(next.fisico + delta, 0, 100);
        break;
      case 'confianza':
        next.confianza = clamp(next.confianza + delta, 0, 100);
        break;
      case 'presupuesto':
        next.presupuesto = Math.max(0, next.presupuesto + delta);
        break;
      case 'racha':
        next.racha += delta;
        break;
      case 'apps':
      case 'goals':
      case 'ast':
        // Stats de partido: no se modifican desde simulación (MGC-439 §acceptance #5).
        break;
      case 'tecnico':
      case 'mental':
      case 'portero':
        nextAttrs[field] = clamp(nextAttrs[field] + delta, 0, 99);
        break;
      default:
        break;
    }
  }

  return { career: next, attrs: nextAttrs };
}

/** Genera un SimulationEvent a partir de un strategyId. */
export function eventFromStrategy(
  strategyId: StrategyId,
  profile: PlayerProfile,
): SimulationEvent {
  const strategy = STRATEGIES[strategyId];

  const eligible = strategy.options.filter(() => {
    if (strategy.condition && !strategy.condition(profile)) return false;
    return true;
  });

  const choices: Choice[] = eligible.map((opt) => ({
    id: opt.id,
    copyId: opt.copyId,
    values: ctxToValues(strategyId, profile),
  }));

  const firstOpt = eligible[0];
  const feedbackCopyId = firstOpt?.feedback.success ?? 'feedback_unknown';

  return {
    kind: strategy.kind,
    strategyId,
    title: strategy.title,
    body: strategy.body,
    feedback: {
      kind: 'neutral',
      copyId: feedbackCopyId,
      values: ctxToValues(strategyId, profile),
    },
    choices,
    consequences: [],
  };
}

/** Devuelve la strategy recomendada según trigger y estado actual. */
export function recommendStrategy(profile: PlayerProfile): StrategyId | null {
  for (const id of EVENT_STRATEGIES) {
    const s = STRATEGIES[id];
    if (s.condition && s.condition(profile)) return id;
  }
  // Lesión activa: ofrecer estrategia de injury según gravedad.
  if (profile.career.lesion.fechasOut > 0) {
    if (profile.career.lesion.kind === 'leve') return 'L1';
    if (profile.career.lesion.kind === 'media') return 'L2';
    if (profile.career.lesion.kind === 'grave') return 'L3';
    return null;
  }
  // MGC-1664 — normalizar a 0-indexed (consistente con v2 currentWeek).
  // `profile.week` se conserva 1..38 por compat con la UI; los helpers
  // puros del motor F2.2+ trabajan en 0..37 para evitar el off-by-one
  // que tenía `week % 5` (semana 1 → WEEKLY[1] en vez de WEEKLY[0]).
  const weekIdx = profile.week - 1;
  if (weekIdx % 3 === 2) return MATCH_STRATEGIES[0];
  return WEEKLY_STRATEGIES[weekIdx % WEEKLY_STRATEGIES.length];
}

const ctxToValues = (id: StrategyId, p: PlayerProfile): Record<string, string | number> => {
  const v: Record<string, string | number> = {
    name: p.name,
    number: p.number,
    age: p.age,
    ovr: p.ovr,
    club: p.club?.name ?? 'Free agent',
    posicion: p.position,
    moral: p.career.moral,
    fisico: p.career.fisico,
    presupuesto: p.career.presupuesto,
  };
  if (id === 'L1') v.fechas = 1;
  if (id === 'L2') v.fechas = 3;
  if (id === 'L3') v.fechas = 6;
  if (id === 'O1') v.monto = 50000;
  return v;
};

/**
 * Aplica la `choice` seleccionada: corre RNG, produce consequences
 * inmutables y un feedback con tone. RNG determinista por (week, season,
 * strategyId).
 */
export function applyChoice(
  profile: PlayerProfile,
  strategyId: StrategyId,
  choiceId: string,
  rng: Rng = createRng(profile.week * 1009 + profile.season * 31 + seedFromString(strategyId)),
): { profile: PlayerProfile; feedback: FeedbackPayload; consequences: Consequence[] } {
  const strategy = STRATEGIES[strategyId];
  const opt = strategy.options.find((o) => o.id === choiceId);
  if (!opt) {
    return {
      profile,
      feedback: { kind: 'neutral', copyId: 'feedback_unknown', values: {} },
      consequences: [],
    };
  }

  const success = opt.prob === 1 ? true : rng.chance(opt.prob);
  const deltas = success ? opt.success : (opt.failure ?? []);
  const { career, attrs } = applyDeltas(profile.career, profile.attrs, deltas);

  let lesion: Injury = career.lesion;
  if (strategyId === 'E5' && !success && rng.chance(0.08)) {
    // MGC-1628 rev 3 §M1 — `startedAtWeek` se persiste en la lesión
    // para que F3+ pueda calcular el decaimiento por tiempo sin rehab.
    // `affectedAttr` se mapea via el helper canónico `affectedAttrFor`.
    lesion = {
      kind: 'leve',
      fechasOut: 1,
      startedAtWeek: profile.week,
      affectedAttr: affectedAttrFor('leve'),
    };
  }

  const tone = toneForStat(deltas[0]?.field ?? '', deltas.reduce((a, b) => a + b.delta, 0));
  const feedback: FeedbackPayload = {
    kind: tone,
    copyId: success ? opt.feedback.success : (opt.feedback.failure ?? opt.feedback.success),
    values: ctxToValues(strategyId, profile),
  };

  const newOvr = recomputeOvrForPosition(profile.position, attrs);
  const newReputation = recomputeReputation(
    { ...career, lesion },
    { ovr: newOvr, age: profile.age, week: profile.week + 1 },
  );

  const nextProfile: PlayerProfile = {
    ...profile,
    attrs,
    ovr: newOvr,
    career: { ...career, lesion, reputation: newReputation },
    week: profile.week + 1,
  };

  return { profile: nextProfile, feedback, consequences: [] };
}

/** Avanza la semana: drena lesión y bumpea season cada 38 semanas. */
export function advanceWeek(profile: PlayerProfile): PlayerProfile {
  // MGC-1628 rev 3 §L3 — convención 0-indexed para el call a
  // `hasMatchThisWeek` debajo. `profile.week` se conserva 1-indexed
  // (1..38) por compat con la UI, pero los helpers del motor puro
  // (F2.2+) trabajan en 0-indexed (0..37) para evitar el off-by-one
  // que tenía el match plan original (`week % 3 === 0` fallaba en
  // week=3 porque la semana 1 del user correspondía al index 0).
  // Ver también `careerStore.ts#hydrateFromSave` y `reputation.ts`.
  const lesionFechasOut = Math.max(0, profile.career.lesion.fechasOut - 1);
  // MGC-1628 rev 3 §M1 — el drenado a `ninguna` también pasa por
  // `affectedAttrFor` para mantener un solo punto de mapeo
  // (kind → attribute) en `types/career.ts`.
  const lesion: Injury = lesionFechasOut === 0
    ? { kind: 'ninguna', fechasOut: 0, startedAtWeek: 0, affectedAttr: affectedAttrFor('ninguna') }
    : { ...profile.career.lesion, fechasOut: lesionFechasOut };

  const season = profile.week >= 38 ? profile.season + 1 : profile.season;
  const week = profile.week >= 38 ? 1 : profile.week + 1;
  const age = season > profile.season ? profile.age + 1 : profile.age;

  return { ...profile, career: { ...profile.career, lesion }, week, season, age };
}

/**
 * MGC-1628 rev 3 §L3 — `hasMatchThisWeek(week, action)`.
 *
 * Determina si la acción `action` corresponde a un partido en la semana
 * `week` (0-indexed, rango [0, 37]). Convención 0-indexed:
 *  - `week = 0` ↔ `profile.week = 1` (primera semana de la temporada).
 *  - `week = 37` ↔ `profile.week = 38` (última semana, cierre).
 *
 * Por convención MGC-1628 rev 3: hay partido cada 3 semanas, offset 0
 * (semanas 0, 3, 6, ..., 36 → matches). Las semanas 1, 2, 4, 5, ... son
 * entrenamiento. Esto corrige el off-by-one del plan original
 * (`week % 3 === 0` con `week` 1-indexed fallaba en la primera semana).
 *
 * Pure function. Sin RNG. Devuelve `true` si la acción debe disparar el
 * match resolver (`match.ts#resolveMatch`); `false` si la semana es de
 * entrenamiento y se debe delegar a `applyTrainingDelta`.
 */
export function hasMatchThisWeek(week: number, _action: string): boolean {
  if (week < 0 || week > 37) return false;
  return week % 3 === 0;
}

/** Helper: setea una lesión. */
export function setInjury(
  profile: PlayerProfile,
  kind: InjuryKind,
  fechasOut: number,
  startedAtWeek: number = profile.week,
): PlayerProfile {
  // MGC-1663 — usa el helper centralizado `affectedAttrFor(kind)` (M1
  // tabla canónica en `types/career.ts`). Antes se re-implementaba el
  // switch acá, violando DRY y arriesgando divergencia con injury-v2.ts
  // y season.ts.
  const affectedAttr = affectedAttrFor(kind);
  return {
    ...profile,
    career: {
      ...profile.career,
      lesion: { kind, fechasOut, startedAtWeek, affectedAttr },
    },
  };
}

/* ─────────────────────── F2.3 — Motor V2 weekly ─────────────────────── */

/** Devuelve `positionStats` del profile o `STAT_INIT` si falta (legacy v1). */
export function getPositionStats(profile: PlayerProfile): PositionStats {
  return profile.positionStats ?? STAT_INIT;
}

/**
 * MGC-1676 — RNG determinista para una decisión semanal. Devuelve el RNG
 * listo para consumir (`rng`) y el snapshot posterior (`snapshot`) que el
 * caller debe persistir en `CareerSaveState.rng` para que el próximo wake
 * (post force-stop / post navigate) reanude desde el cursor avanzado.
 *
 * Si se pasa `snapshot`, restaura el cursor desde `state.rng` (semanas
 * previas ya consumieron RNG; este consume los siguientes draws). Sin
 * snapshot, deriva el seed de (week, season, name, optionId) y arranca
 * con cursor=0 — fallback determinista V1 (tests / saves sin snapshot).
 */
export function weeklyRng(
  profile: PlayerProfile,
  optionId: string,
  snapshot?: RngSnapshot,
): { rng: Rng; snapshot: RngSnapshot } {
  if (snapshot) {
    const rng = createRngFromSnapshot(snapshot);
    return { rng, snapshot: snapshotRng(rng) };
  }
  const seed =
    profile.week * 1009 +
    profile.season * 31 +
    seedFromString(`${profile.name}|${optionId}`);
  const rng = createRng(seed);
  return { rng, snapshot: createRngSnapshot(seed) };
}

/**
 * Opciones semanales disponibles para el profile. Filtra:
 *  - `rehabilitacion` solo si hay lesión activa.
 *  - Cualquier otra opción distinta a `rehabilitacion` se oculta si hay
 *    lesión activa (MGC-1657 AC: la lesión bloquea las decisiones de
 *    entrenamiento/partido por la duración de la lesión).
 */
export function availableWeeklyOptions(profile: PlayerProfile): WeeklyBaseOption[] {
  const injured = isInjuredV2(profile);
  return (Object.values(WEEKLY_BASE_OPTIONS) as WeeklyBaseOption[]).filter((opt) => {
    if (opt.requiresInjury) return injured;
    return !injured;
  });
}

/**
 * Resultado de la decisión semanal F2.3. Inmutable; la UI lo consume
 * para pintar feedback inline + outcome card.
 */
export type WeeklyChoiceResult = {
  profile: PlayerProfile;
  outcomeId: string;
  copyId: string;
  feedback: FeedbackPayload;
  /** Outcome elegido por el RNG del árbol posicional (debug + tests). */
  outcome: PositionOutcome;
  /** Stats posicionales nuevos (útil para la UI de growth). */
  positionStats: PositionStats;
  /** True si la semana disparó lesión v2. */
  injuryFired: boolean;
  /** Lesión resultante si disparó (null en caso contrario). */
  injury: Injury | null;
  /**
   * MGC-1676 — snapshot del cursor RNG tras consumir la decisión. El
   * caller (engine.ts#weeklyChoice) lo persiste en `state.rng` para que
   * el próximo wake (post force-stop) reanude el stream sin perder draws.
   */
  rngSnapshot: RngSnapshot;
};

/**
 * Aplica la decisión semanal F2.3 al `profile`. Pipeline:
 *
 *  1. Resolver `WEEKLY_BASE_OPTIONS[optionId]`.
 *  2. Evaluar éxito (Bernoulli contra `opt.prob`) con RNG determinista.
 *  3. Si éxito → invocar `getPositionTree(position)` y samplear un
 *     outcome del root (4 outcomes suman 1.0) con RNG; merge de deltas
 *     posicionales via `applyStatDeltas`. Si falla → aplicar `failureDeltas`
 *     posicionales (puede ser undefined → no-op).
 *  4. Aplicar `careerDeltas` al `CareerStats` (moral/fisico/confianza).
 *  5. Aplicar `applyStatDeltas` al `profile.positionStats` (clamp 0..99).
 *  6. `maybeRollInjury(profile, doubleShiftStreak, rng)` — si dispara,
 *     pisa `career.lesion` con la Injury v2 (kind + fechasOut).
 *  7. Incrementar / resetear `doubleShiftStreak` según la opción
 *     (doble_turno ++; cualquier otra distinta a descanso → 0).
 *  8. Marcar `weeklyInjuryFlipped` cuando la lesión se dispara esta
 *     semana (para que la UI muestre el feedback inmediato).
 *  9. `week += 1` y bumpear reputación + OVR (pure functions).
 *
 * Pure function: no muta el profile, devuelve uno nuevo.
 */
/**
 * MGC-1676 — el tercer argumento puede ser:
 *  - `Rng` (legacy/test): el caller ya construyó un RNG (ej. mock).
 *  - `RngSnapshot` (state.rng persistido): reanuda el cursor y devuelve
 *    snapshot avanzado en `result.rngSnapshot`.
 *  - `undefined`: deriva seed de (week, season, name, optionId) con
 *    cursor=0 (V1 back-compat / primer inicio).
 */
export function applyWeeklyChoice(
  profile: PlayerProfile,
  optionId: WeeklyBaseOptionId,
  rngOrSnapshot?: Rng | RngSnapshot,
): WeeklyChoiceResult {
  let rng: Rng;
  if (rngOrSnapshot && typeof (rngOrSnapshot as Rng).next === 'function') {
    rng = rngOrSnapshot as Rng;
  } else {
    rng = weeklyRng(profile, optionId, rngOrSnapshot as RngSnapshot | undefined).rng;
  }
  const opt = WEEKLY_BASE_OPTIONS[optionId];
  if (!opt) {
    return {
      profile,
      outcomeId: 'invalid_option',
      copyId: 'feedback_unknown',
      feedback: { kind: 'neutral', copyId: 'feedback_unknown', values: {} },
      outcome: {
        id: 'noop',
        copyId: 'noop',
        prob: 1,
        deltas: {},
        doubleStreakDelta: 0,
      },
      positionStats: getPositionStats(profile),
      injuryFired: false,
      injury: null,
      rngSnapshot: createRngSnapshot(0),
    };
  }

  // 1) Éxito / falla.
  const success = opt.prob === 1 ? true : rng.chance(opt.prob);
  let outcomeDeltas: Partial<Record<StatKey, number>> = {};
  let outcome: PositionOutcome;
  let copyId: string = opt.copyId;

  if (success) {
    // 2) Samplear outcome del árbol posicional.
    const tree = getPositionTree(profile.position);
    const roll = rng.next();
    let acc = 0;
    outcome = tree.root.outcomes[0];
    for (const o of tree.root.outcomes) {
      acc += o.prob;
      if (roll < acc) {
        outcome = o;
        break;
      }
    }
    outcomeDeltas = { ...opt.successDeltas, ...outcome.deltas };
    copyId = outcome.copyId;
  } else {
    outcomeDeltas = { ...(opt.failureDeltas ?? {}) };
    outcome = {
      id: 'failed',
      copyId: opt.copyId,
      prob: 1,
      deltas: {},
      doubleStreakDelta: 0,
    };
  }

  // 3) PositionStats: aplicar deltas clamp 0..99.
  const prevPositionStats = getPositionStats(profile);
  const nextPositionStats = applyStatDeltas(prevPositionStats, outcomeDeltas);

  // 4) CareerStats deltas (moral/fisico/confianza).
  let nextCareer: CareerStats = { ...profile.career, reputation: { ...profile.career.reputation } };
  const careerDeltas = success
    ? opt.careerDeltas ?? {}
    : /* on failure: revert deltas by negating success? mantenemos éxito
         para opciones no probabilísticas (descanso, rehab) y aplicamos
         `failureDeltas` career si están. V2 spec no define career deltas
         en failure; conservamos success.careerDeltas por compatibilidad. */
      opt.careerDeltas ?? {};
  if (careerDeltas.fisico !== undefined) {
    nextCareer.fisico = clamp(nextCareer.fisico + careerDeltas.fisico, 0, 100);
  }
  if (careerDeltas.moral !== undefined) {
    nextCareer.moral = clamp(nextCareer.moral + careerDeltas.moral, 0, 100);
  }
  if (careerDeltas.confianza !== undefined) {
    nextCareer.confianza = clamp(nextCareer.confianza + careerDeltas.confianza, 0, 100);
  }

  // 5) DoubleShiftStreak: doble_turno ++; cualquier otra opción distinta
  //    de descanso lo resetea; descanso mantiene el streak (decision del
  //    usuario: descanso intencional no rompe racha — la racha solo
  //    representa doble turno consecutivo, no "actividad").
  const prevStreak = nextCareer.doubleShiftStreak ?? 0;
  if (optionId === 'doble_turno') {
    nextCareer.doubleShiftStreak = prevStreak + 1;
  } else if (optionId === 'descanso') {
    nextCareer.doubleShiftStreak = prevStreak;
  } else {
    nextCareer.doubleShiftStreak = 0;
  }

  // 6) Injury check (post-choice).
  // MGC-1677 HIGH-2: si ya existe una lesión activa (fechasOut > 0) NO
  // se invoca `maybeRollInjury` — preservar el remanente. Una re-lesión
  // mientras se rehabilita no resetea el counter; recién se re-evaluará
  // la próxima semana cuando `fechasOut` llegue a 0 vía `advanceWeek`.
  let injury: Injury | null = null;
  let injuryFired = false;
  if (nextCareer.lesion.fechasOut > 0) {
    // Mantener lesión activa intacta. weeklyInjuryFlipped ya refleja el
    // disparo original; no lo flipeamos de nuevo para no spammear la UI.
    injury = nextCareer.lesion;
  } else {
    injury = maybeRollInjury(
      { ...profile, career: nextCareer },
      nextCareer.doubleShiftStreak ?? 0,
      rng,
    );
    if (injury) {
      nextCareer = { ...nextCareer, lesion: injury };
      nextCareer.weeklyInjuryFlipped = true;
      injuryFired = true;
    } else if (nextCareer.lesion.fechasOut === 0) {
      // Drenar el flag si ya no hay lesión activa.
      nextCareer.weeklyInjuryFlipped = false;
    }
  }

  // 7) Recompute OVR + reputación.
  const newOvr = recomputeOvrForPosition(profile.position, profile.attrs);
  const newReputation = recomputeReputation(
    { ...nextCareer, lesion: nextCareer.lesion },
    { ovr: newOvr, age: profile.age, week: profile.week + 1 },
  );
  nextCareer = { ...nextCareer, reputation: newReputation };

  // 8) Compose next profile.
  const nextProfile: PlayerProfile = {
    ...profile,
    positionStats: nextPositionStats,
    career: nextCareer,
    ovr: newOvr,
    week: profile.week + 1,
  };

  // 9) Feedback inline. Tone = success si success && !injuryFired; warning
  //    si lesionó; danger si falló Y lesionó; neutral en rehab determinista.
  let tone: FeedbackTone = success ? 'success' : 'warning';
  if (injuryFired) tone = 'danger';
  const feedback: FeedbackPayload = {
    kind: tone,
    copyId: success ? `feedback_${optionId}_success` : `feedback_${optionId}_failure`,
    values: {
      statKeys: Object.keys(outcomeDeltas).join(',') || 'none',
      lesion: injury?.kind ?? 'ninguna',
      fechasOut: injury?.fechasOut ?? 0,
    },
  };

  return {
    profile: nextProfile,
    outcomeId: outcome.id,
    copyId,
    feedback,
    outcome,
    positionStats: nextPositionStats,
    injuryFired,
    injury,
    rngSnapshot: snapshotRng(rng),
  };
}

/**
 * Resuelve un partido individual en la matchweek. Suma goals + ast al
 * `profile.stats` y bumpea `career.matchweekStats`. Pure function.
 */
export type ResolveMatchResult = {
  profile: PlayerProfile;
  match: MatchOutcome;
  /**
   * MGC-1676 — snapshot RNG tras consumir el resolve. Persistir en
   * `state.rng` para que el próximo partido (post force-stop) reanude.
   */
  rngSnapshot: RngSnapshot;
};

/**
 * MGC-1676 — el segundo argumento puede ser `Rng` (legacy/test) o
 * `RngSnapshot` (state.rng persistido). Sin args: deriva seed V1.
 */
export function resolveWeeklyMatch(
  profile: PlayerProfile,
  rngOrSnapshot?: Rng | RngSnapshot,
): ResolveMatchResult {
  let rng: Rng;
  if (rngOrSnapshot && typeof (rngOrSnapshot as Rng).next === 'function') {
    rng = rngOrSnapshot as Rng;
  } else {
    rng = weeklyRng(profile, 'match', rngOrSnapshot as RngSnapshot | undefined).rng;
  }
  const positionStats = getPositionStats(profile);
  const match = resolveMatch(profile, positionStats, rng);

  const prevMatchweek = profile.career.matchweekStats;
  const nextStats = {
    apps: (prevMatchweek?.apps ?? 0) + 1,
    goals: (prevMatchweek?.goals ?? 0) + match.goals,
    ast: prevMatchweek?.ast ?? 0,
    clubId: profile.club?.id ?? 'free',
  };
  // Acumulado total (no se sobreescribe; se suma partido a partido).
  const total = {
    apps: profile.stats.apps + 1,
    goals: profile.stats.goals + match.goals,
    ast: profile.stats.ast, // ast V2 no está en `MatchOutcome`; placeholder
  };

  const nextCareer: CareerStats = {
    ...profile.career,
    matchweekStats: nextStats,
  };

  const nextProfile: PlayerProfile = {
    ...profile,
    stats: total,
    career: nextCareer,
  };

  return { profile: nextProfile, match, rngSnapshot: snapshotRng(rng) };
}

// Los consumidores deben importar STRATEGIES / *_STRATEGIES desde './strategy'
// directamente para evitar duplicados cuando se hace `export *` desde index.