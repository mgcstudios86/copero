import { describe, expect, it } from 'vitest';
import {
  PHASE_LABELS,
  PRETEMPORADA_WEEK,
  SEASON_LENGTH,
  buildCalendar,
  buildStandings,
  phaseFromWeek,
  placeholderPosition,
} from './phase';

describe('phase model (MGC-212)', () => {
  it('pretemporada para week<=0', () => {
    expect(phaseFromWeek(PRETEMPORADA_WEEK)).toBe('pretemporada');
    expect(phaseFromWeek(-1)).toBe('pretemporada');
  });

  it('regular para weeks 1..34', () => {
    expect(phaseFromWeek(1)).toBe('regular');
    expect(phaseFromWeek(34)).toBe('regular');
  });

  it('fin para week>=38', () => {
    expect(phaseFromWeek(SEASON_LENGTH)).toBe('fin');
    expect(phaseFromWeek(40)).toBe('fin');
  });

  it('playoff para top 4 en weeks 35..37', () => {
    expect(phaseFromWeek(35, 1)).toBe('playoff');
    expect(phaseFromWeek(37, 4)).toBe('playoff');
  });

  it('relegacion para últimos 4 en weeks 35..37', () => {
    expect(phaseFromWeek(35, 17)).toBe('relegacion');
    expect(phaseFromWeek(37, 20)).toBe('relegacion');
  });

  it('mantiene regular si no hay standings en weeks 35..37', () => {
    expect(phaseFromWeek(35, null)).toBe('regular');
    expect(phaseFromWeek(36, null)).toBe('regular');
  });

  it('PHASE_LABELS cubre todas las fases', () => {
    expect(Object.keys(PHASE_LABELS).sort()).toEqual(
      ['fin', 'playoff', 'pretemporada', 'regular', 'relegacion'].sort(),
    );
  });

  it('placeholderPosition es determinista', () => {
    const a = placeholderPosition(42, 10, 20);
    const b = placeholderPosition(42, 10, 20);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThanOrEqual(20);
  });

  it('buildCalendar genera 38 fechas deterministas', () => {
    const rng = {
      int: (min: number, max: number) => {
        // Mulberry32 trivial determinista
        const v = (min * 31 + max * 17) % (max - min + 1);
        return min + v;
      },
    };
    const calendar = buildCalendar(123, ['A', 'B', 'C', 'D'], rng);
    expect(calendar).toHaveLength(38);
    expect(calendar[0].index).toBe(1);
    expect(calendar[37].index).toBe(38);
    expect(calendar.every((row) => row.result === 'pendiente')).toBe(true);
  });

  it('buildStandings ordena por puntos y diferencia de gol', () => {
    const standings = buildStandings(7, ['A', 'B', 'C'], 10);
    expect(standings).toHaveLength(3);
    expect(standings[0].position).toBe(1);
    expect(standings[0].points).toBeGreaterThanOrEqual(standings[1].points);
    expect(standings[1].points).toBeGreaterThanOrEqual(standings[2].points);
  });
});