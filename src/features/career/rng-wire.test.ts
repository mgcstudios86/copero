import { describe, expect, it } from 'vitest';
import { step, initialSnapshot } from './engine';
import { createRngSnapshot } from './rng';
import type { CareerSnapshot } from '@/types/career';

/**
 * MGC-1676 — wire del RNG snapshot v2 en weeklyChoice +
 * resolveMatchweek. Cada decisión semanal debe restaurar el cursor
 * persistido en `state.rng` (cuando está presente) y avanzar el
 * snapshot tras la decisión, para que un force-stop entre semanas no
 * rompa la reproducibilidad.
 */
describe('wire del RngSnapshot v2 (MGC-1676)', () => {
  const withSnapshot = (rng: CareerSnapshot['rng']): CareerSnapshot => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'Mateo' });
    s = step(s, { type: 'setPosition', position: 'ST' });
    return { ...s, seed: 12345, rng };
  };

  it('weeklyChoice avanza el cursor del snapshot persistido', () => {
    const start = withSnapshot(createRngSnapshot(12345));
    const next = step(start, {
      type: 'weeklyChoice',
      optionId: 'entrenamiento_fisico_especifico',
    });
    expect(next.rng).toBeDefined();
    expect(next.rng?.seed).toBe(12345);
    // El cursor debe haber avanzado (rng consumió al menos un next()
    // para el Bernoulli y otro para el árbol posicional).
    expect(next.rng?.cursor ?? 0).toBeGreaterThan(start.rng?.cursor ?? 0);
  });

  it('dos applyWeeklyChoice consecutivos divergen si restauran el snapshot', () => {
    const start = withSnapshot(createRngSnapshot(12345));
    const a = step(start, {
      type: 'weeklyChoice',
      optionId: 'entrenamiento_fisico_especifico',
    });
    const b = step(a, {
      type: 'weeklyChoice',
      optionId: 'entrenamiento_fisico_especifico',
    });
    expect(b.rng?.cursor ?? 0).toBeGreaterThan(a.rng?.cursor ?? 0);
    // El perfil también debe avanzar (week++) y los stats posicionales
    // se actualizan.
    expect(b.profile.week).toBeGreaterThan(a.profile.week);
  });

  it('resolveMatchweek también avanza el cursor del snapshot', () => {
    const start = withSnapshot(createRngSnapshot(12345));
    const next = step(start, { type: 'resolveMatchweek' });
    expect(next.rng?.cursor ?? 0).toBeGreaterThan(start.rng?.cursor ?? 0);
  });

  it('replay determinista post-force-stop: restaurar snapshot y repetir la misma acción da el mismo resultado', () => {
    const start = withSnapshot(createRngSnapshot(12345));
    const a = step(start, {
      type: 'weeklyChoice',
      optionId: 'entrenamiento_fisico_especifico',
    });

    // Simulamos force-stop + reabrir save: partimos del snapshot
    // persistido por el primer step pero NO aplicamos la acción.
    const replay = step(start, {
      type: 'weeklyChoice',
      optionId: 'entrenamiento_fisico_especifico',
    });
    expect(replay.profile.career.moral).toBe(a.profile.career.moral);
    expect(replay.profile.week).toBe(a.profile.week);
    expect(replay.rng).toEqual(a.rng);
  });
});
