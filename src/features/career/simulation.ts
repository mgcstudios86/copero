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
 */

import { createRng, type Rng } from './rng';
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
  if (profile.career.lesion.fechasOut > 0) return null;
  if (profile.week % 3 === 0) return MATCH_STRATEGIES[0];
  return WEEKLY_STRATEGIES[profile.week % WEEKLY_STRATEGIES.length];
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
  rng: Rng = createRng(profile.week * 1009 + profile.season * 31 + strategyId.charCodeAt(0)),
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
    lesion = { kind: 'leve', fechasOut: 1 };
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
  const lesionFechasOut = Math.max(0, profile.career.lesion.fechasOut - 1);
  const lesion: Injury = lesionFechasOut === 0
    ? { kind: 'ninguna', fechasOut: 0 }
    : { ...profile.career.lesion, fechasOut: lesionFechasOut };

  const season = profile.week >= 38 ? profile.season + 1 : profile.season;
  const week = profile.week >= 38 ? 1 : profile.week + 1;
  const age = season > profile.season ? profile.age + 1 : profile.age;

  return { ...profile, career: { ...profile.career, lesion }, week, season, age };
}

/** Helper: setea una lesión. */
export function setInjury(profile: PlayerProfile, kind: InjuryKind, fechasOut: number): PlayerProfile {
  return {
    ...profile,
    career: {
      ...profile.career,
      lesion: { kind, fechasOut },
    },
  };
}

// Los consumidores deben importar STRATEGIES / *_STRATEGIES desde './strategy'
// directamente para evitar duplicados cuando se hace `export *` desde index.