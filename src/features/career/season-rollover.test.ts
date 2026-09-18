import { describe, expect, it } from 'vitest';
import {
  applySeasonRollover,
  shouldRollover,
} from './season-rollover';

describe('MGC-487 — season rollover', () => {
  it('shouldRollover devuelve true en week >= 38', () => {
    expect(shouldRollover({ season: 3, week: 38, age: 26 })).toBe(true);
    expect(shouldRollover({ season: 3, week: 39, age: 26 })).toBe(true);
  });

  it('shouldRollover devuelve false en week < 38', () => {
    expect(shouldRollover({ season: 3, week: 37, age: 26 })).toBe(false);
    expect(shouldRollover({ season: 3, week: 1, age: 26 })).toBe(false);
  });

  it('applySeasonRollover bumpea season, resetea week=1, age+1', () => {
    const r = applySeasonRollover({ season: 3, week: 38, age: 26 });
    expect(r).toEqual({
      season: 4,
      week: 1,
      age: 27,
      archived: { season: 3, champion: null, closedAt: 'rollover' },
    });
  });

  it('applySeasonRollover archiva el campeón si viene en el input', () => {
    const r = applySeasonRollover({
      season: 5,
      week: 38,
      age: 28,
      champion: 'Real Madrid',
    });
    expect(r.archived.champion).toBe('Real Madrid');
    expect(r.archived.season).toBe(5);
  });

  it('applySeasonRollover lanza si week < 38', () => {
    expect(() =>
      applySeasonRollover({ season: 1, week: 20, age: 19 }),
    ).toThrow();
  });
});
