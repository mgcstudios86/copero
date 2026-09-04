/**
 * MGC-1650 (WF5 post-partido) — tests del helper `ratingFromOutcome` y
 * `deltasFromRating`. Estos helpers son la fuente de verdad del rating
 * que muestra `/post-match` y los deltas preview que se aplican a
 * careerStore sólo si el usuario confirma «Siguiente semana →».
 */
import { describe, expect, it } from 'vitest';
import {
  clampCareerStat,
  deltasFromRating,
  ratingFromOutcome,
} from './match';
import type { MatchOutcome } from './match';

function mkOutcome(overrides: Partial<MatchOutcome> = {}): MatchOutcome {
  return {
    score: 50,
    goals: 1,
    cleanSheet: false,
    breakdown: { base: 50, luck: 0, clubFactor: 0, weighted: 50 },
    ...overrides,
  };
}

describe('MGC-1650 · WF5 rating + deltas', () => {
  it('ratingFromOutcome: score=50 → 5.0 base', () => {
    expect(ratingFromOutcome(mkOutcome({ score: 50 }))).toBe(5.0);
  });

  it('ratingFromOutcome: hat-trick (goals=3) suma +0.5 bonus', () => {
    expect(ratingFromOutcome(mkOutcome({ score: 80, goals: 3 }))).toBe(8.5);
  });

  it('ratingFromOutcome: cleanSheet suma +0.3 bonus', () => {
    expect(ratingFromOutcome(mkOutcome({ score: 70, cleanSheet: true }))).toBe(7.3);
  });

  it('ratingFromOutcome: clamp a [0.0, 10.0] con score>100', () => {
    expect(
      ratingFromOutcome(
        mkOutcome({ score: 150, goals: 5, cleanSheet: true }),
      ),
    ).toBeLessThanOrEqual(10.0);
  });

  it('ratingFromOutcome: clamp a >=0 con score<0', () => {
    expect(ratingFromOutcome(mkOutcome({ score: -10 }))).toBe(0);
  });

  it('ratingFromOutcome: redondea a 1 decimal', () => {
    // score=63 → 6.3 (sin bonus); con cleanSheet sería 6.6.
    expect(ratingFromOutcome(mkOutcome({ score: 63 }))).toBe(6.3);
    expect(
      ratingFromOutcome(mkOutcome({ score: 63, cleanSheet: true })),
    ).toBe(6.6);
  });

  it('deltasFromRating: rating=8.5 → moral+12, fisico-8, confianza+15', () => {
    expect(deltasFromRating(8.5)).toEqual({
      moralDelta: 12,
      fisicoDelta: -8,
      confianzaDelta: 15,
    });
  });

  it('deltasFromRating: rating=2.0 → moral-12, fisico-1, confianza-15', () => {
    expect(deltasFromRating(2.0)).toEqual({
      moralDelta: -12,
      fisicoDelta: -1,
      confianzaDelta: -15,
    });
  });

  it('deltasFromRating: rating=5.0 → deltas neutros', () => {
    expect(deltasFromRating(5.0)).toEqual({
      moralDelta: 0,
      fisicoDelta: -3,
      confianzaDelta: 0,
    });
  });

  it('clampCareerStat: clamp a [0, 100]', () => {
    expect(clampCareerStat(150)).toBe(100);
    expect(clampCareerStat(-10)).toBe(0);
    expect(clampCareerStat(50)).toBe(50);
  });
});
/**
 * MGC-1729 (MEDIUM-1) — invariante de no-mutación del flujo WF4/WF5:
 * salir de `/match` o `/post-match` SIN confirmar «Siguiente semana →»
 * no debe tocar `careerStore`. El review de MGC-1722 marcó que la suite
 * sólo cubría funciones puras; este bloque ejercita el ciclo real
 * `startMatch()` → `reset()` sobre las stores.
 */
describe('MGC-1729 · salir sin confirmar no muta careerStore', () => {
  it('startMatch() deposita el outcome en matchStore y deja careerStore intacto', async () => {
    const { useCareerStore } = await import('@/shared/store/careerStore');
    const { useMatchStore } = await import('@/shared/store/matchStore');

    const before = useCareerStore.getState().profile;
    await useCareerStore.getState().startMatch();

    expect(useMatchStore.getState().outcome).not.toBeNull();
    expect(useMatchStore.getState().nextProfile).not.toBeNull();
    expect(useMatchStore.getState().committed).toBe(false);
    // Misma referencia: startMatch NO escribe en careerStore.
    expect(useCareerStore.getState().profile).toBe(before);
  });

  it('reset() (cleanup al salir sin confirmar) limpia matchStore y no toca careerStore', async () => {
    const { useCareerStore } = await import('@/shared/store/careerStore');
    const { useMatchStore } = await import('@/shared/store/matchStore');

    await useCareerStore.getState().startMatch();
    const snapshot = JSON.stringify(useCareerStore.getState().profile);

    useMatchStore.getState().reset();

    expect(useMatchStore.getState().outcome).toBeNull();
    expect(useMatchStore.getState().nextProfile).toBeNull();
    expect(useMatchStore.getState().preview).toBeNull();
    expect(useMatchStore.getState().committed).toBe(false);
    expect(JSON.stringify(useCareerStore.getState().profile)).toBe(snapshot);
  });

  it('commitMatch() sí aplica el nextProfile (contraste con el caso anterior)', async () => {
    const { useCareerStore } = await import('@/shared/store/careerStore');
    const { useMatchStore } = await import('@/shared/store/matchStore');

    const before = useCareerStore.getState().profile;
    await useCareerStore.getState().startMatch();
    await useCareerStore.getState().commitMatch();

    expect(useMatchStore.getState().outcome).toBeNull();
    expect(useMatchStore.getState().committed).toBe(true);
    expect(useCareerStore.getState().profile).not.toBe(before);
  });
});
