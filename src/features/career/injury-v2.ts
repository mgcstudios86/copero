/**
 * F2.2 — Sistema de lesiones v2 (MGC-1629 AC §"Sistema de lesiones").
 *
 * Reglas:
 * - Probabilidad crece con `fatigue > 70` (proxy: career.fisico < 30 ⇒
 *   carga acumulada > 70). 100 puntos de fatigue = sin energía.
 * - Y crece adicionalmente con `doubleShiftStreak > 3` (doble turno
 *   consecutivo más de 3 semanas seguidas).
 * - Lesión sostenida: si se dispara, dura entre 2 y 6 semanas.
 * - Durante la lesión, la decisión semanal solo ofrece rehabilitación.
 */

import type { Injury, InjuryKind, PlayerProfile } from '@/types/career';
import { affectedAttrFor } from '@/types/career';
import { createRng, type Rng } from './rng';

export const DOUBLE_SHIFT_STREAK_INJURY_THRESHOLD = 3;

/** Probabilidad base (sin modificadores) de lesión por partido/turno. */
export const INJURY_BASE_RATE = 0.02;

/**
 * Calcula la fatiga acumulada (0..100).
 *
 * Proxy: `fatigue = max(0, 80 - career.fisico) * 1.25` (cap 100). Mantener
 * fisico < 30 ⇒ carga > 70. Es determinista; la aleatoriedad la añade el
 * RNG al disparar la lesión.
 */
export function fatigueFromCareer(career: PlayerProfile['career']): number {
  const proxy = Math.max(0, (80 - career.fisico) * 1.25);
  return Math.min(100, proxy);
}

/** Score modificador de probabilidad por fatiga (0..1.0). Lineal desde 70. */
export function fatigueInjuryMod(fatigue: number): number {
  if (fatigue <= 70) return 0;
  return Math.min(1.0, (fatigue - 70) / 30);
}

/** Score modificador por doble turno consecutivo (0..1.0). */
export function doubleStreakInjuryMod(streak: number): number {
  if (streak <= DOUBLE_SHIFT_STREAK_INJURY_THRESHOLD) return 0;
  return Math.min(1.0, (streak - DOUBLE_SHIFT_STREAK_INJURY_THRESHOLD) / 4);
}

/**
 * Probabilidad efectiva de lesión en el turno actual. Combina base, fatiga
 * y streak. Devuelve valor en [0, 1]. No incluye randomness.
 */
export function injuryProbability(
  profile: PlayerProfile,
  doubleShiftStreak: number,
): number {
  const fatigue = fatigueFromCareer(profile.career);
  const modFatigue = fatigueInjuryMod(fatigue);
  const modStreak = doubleStreakInjuryMod(doubleShiftStreak);
  // Suma aditiva (más riesgo), cap 1.
  return Math.min(1.0, INJURY_BASE_RATE + modFatigue * 0.35 + modStreak * 0.25);
}

/**
 * Decide si el turno dispara una lesión y devuelve la Injury resultante.
 * Si no hay lesión, devuelve `null`.
 *
 * - Duración sostenida 2..6 semanas (rango inclusivo, RNG seedeado).
 * - Kind se elige con peso: leve 0.6, media 0.3, grave 0.1.
 */
export function maybeRollInjury(
  profile: PlayerProfile,
  doubleShiftStreak: number,
  rng: Rng,
): Injury | null {
  const p = injuryProbability(profile, doubleShiftStreak);
  if (p <= 0) return null;
  if (!rng.chance(p)) return null;
  const fechasOut = rng.int(2, 6);
  const roll = rng.next();
  let kind: InjuryKind;
  if (roll < 0.6) kind = 'leve';
  else if (roll < 0.9) kind = 'media';
  else kind = 'grave';
  // MGC-1628 rev 3 §M1 — `startedAtWeek` se persiste al disparar la
  // lesión (semana actual 1-indexed del profile). `affectedAttr` se
  // obtiene del helper canónico `affectedAttrFor(kind)` (mapeo
  // determinístico leve→fisico, media→mental, grave→tecnico).
  return {
    kind,
    fechasOut,
    startedAtWeek: profile.week,
    affectedAttr: affectedAttrFor(kind),
  };
}

/**
 * Determina si la semana debe forzarse a rehabilitación (no se pueden
 * tomar decisiones de entrenamiento/partido).
 */
export function isInjured(profile: PlayerProfile): boolean {
  return profile.career.lesion.fechasOut > 0;
}

/** Helper que produce un RNG a partir del snapshot del jugador. */
export function injuryRngFor(profile: PlayerProfile): Rng {
  // Seed estable: nombre + week + season + un salt. Reproducible en QA.
  const seedBase = [...(profile.name || 'anon')].reduce(
    (acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0,
    0,
  );
  return createRng(seedBase ^ (profile.week * 1009 + profile.season * 31));
}
