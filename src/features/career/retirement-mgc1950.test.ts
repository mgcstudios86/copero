import { describe, expect, it } from 'vitest';
import { buildRetirementSummary } from './retirement';
import { RETIREMENT_AGE } from './season';
import type { PlayerProfile, SeasonLog } from '@/types/career';

/**
 * MGC-1950 (PR #464 cleanup CTO) — regresión para el bug de retiro
 * temprano: `buildRetirementSummary` clampeaba la edad a
 * `Math.max(profile.age, RETIREMENT_AGE=34)`, mostrando 34 aunque el
 * jugador se hubiera retirado a los 16. La nueva implementación
 * preserva la edad real cuando `profile.age < RETIREMENT_AGE` y marca
 * `retiredEarly: true` para que la UI use copy contextual.
 */

function makeProfile(age: number): PlayerProfile {
  // buildRetirementSummary solo lee `profile.age`, `profile.ovr` y
  // `profile.stats` (apps/goals/ast). El resto del shape es ruido para
  // el constructor — casteamos a PlayerProfile con un objeto mínimo
  // para evitar tener que poblar los 15+ campos anidados de CareerStats.
  return {
    age,
    ovr: 75,
    stats: { apps: 0, goals: 0, ast: 0 },
  } as unknown as PlayerProfile;
}

function makeLog(): SeasonLog {
  return {
    timeline: [],
    events: [],
  };
}

describe('MGC-1950 buildRetirementSummary — retiro temprano', () => {
  it('preserva la edad real cuando es MENOR a RETIREMENT_AGE', () => {
    // Carrera que terminó a los 16 (retireEarly desde el dashboard).
    // Antes: retirementAge = max(16, 34) = 34 (BUG).
    // Ahora: retirementAge = 16 + retiredEarly = true.
    const profile = makeProfile(16);
    const summary = buildRetirementSummary(profile, makeLog());
    expect(summary.retirementAge).toBe(16);
    expect(summary.retiredEarly).toBe(true);
  });

  it('preserva la edad real para cualquier edad < 34 (boundary check)', () => {
    for (const age of [16, 17, 18, 20, 25, 30, 33]) {
      const summary = buildRetirementSummary(makeProfile(age), makeLog());
      expect(summary.retirementAge).toBe(age);
      expect(summary.retiredEarly).toBe(true);
    }
  });

  it('marca retiredEarly=false en retiro natural ≥ RETIREMENT_AGE', () => {
    for (const age of [RETIREMENT_AGE, 35, 40]) {
      const summary = buildRetirementSummary(makeProfile(age), makeLog());
      expect(summary.retirementAge).toBe(age);
      expect(summary.retiredEarly).toBe(false);
    }
  });

  it('mantiene el resto del summary intacto', () => {
    const profile: PlayerProfile = {
      ...makeProfile(20),
      ovr: 82,
      stats: { apps: 100, goals: 30, ast: 15 },
    };
    const log: SeasonLog = {
      timeline: [{ season: 1, age: 20, clubId: 'boca', clubName: 'Boca', ovr: 78, apps: 30, goals: 8, assists: 4 }],
      events: [{ season: 1, kind: 'titulo', copyId: 'titulo-copa', values: { club: 'Boca Juniors' } }],
    };
    const summary = buildRetirementSummary(profile, log);
    expect(summary.retirementAge).toBe(20);
    expect(summary.retiredEarly).toBe(true);
    expect(summary.finalOvr).toBe(82);
    expect(summary.totalApps).toBe(100);
    expect(summary.totalGoals).toBe(30);
    expect(summary.totalAssists).toBe(15);
    expect(summary.vitrina).toEqual(['Boca Juniors']);
    expect(summary.timeline).toHaveLength(1);
  });
});
