import { describe, it, expect } from 'vitest';
import {
  initialSnapshot,
  step,
  runActions,
  DEFAULT_ROUND_DURATION_MS,
  DEFAULT_TOTAL_ROUNDS,
} from '../../src/features/game/engine';

describe('engine FSM', () => {
  it('initial snapshot es idle sin palabra', () => {
    const s = initialSnapshot();
    expect(s.status).toBe('idle');
    expect(s.currentWord).toBeNull();
    expect(s.score).toBe(0);
  });

  it('pickCategory desde idle transiciona a category', () => {
    const s = step(initialSnapshot(), { type: 'pickCategory' });
    expect(s.status).toBe('category');
  });

  it('startGame desde category produce primera palabra', () => {
    const s = step(initialSnapshot(), {
      type: 'startGame',
      payload: {
        category: 'futbol',
        rng: () => 0, // determinista: primer elemento
      },
    });
    expect(s.status).toBe('playing');
    expect(s.currentCategory).toBe('futbol');
    expect(s.round).toBe(1);
    expect(s.currentWord).not.toBeNull();
  });

  it('resolveRound suma puntos y pasa a roundEnd', () => {
    const s1 = step(initialSnapshot(), {
      type: 'startGame',
      payload: { category: 'futbol', rng: () => 0 },
    });
    const s2 = step(s1, {
      type: 'resolveRound',
      outcome: 'correct',
      remainingMs: DEFAULT_ROUND_DURATION_MS,
    });
    expect(s2.status).toBe('roundEnd');
    expect(s2.score).toBeGreaterThan(0);
    expect(s2.streak).toBe(1);
  });

  it('nextRound avanza ronda hasta gameEnd cuando se supera totalRounds', () => {
    let s = step(initialSnapshot(), {
      type: 'startGame',
      payload: { category: 'futbol', totalRounds: 2, rng: () => 0 },
    });
    // round 1 → resolve → nextRound
    s = step(s, { type: 'resolveRound', outcome: 'correct', remainingMs: 30_000 });
    s = step(s, { type: 'nextRound' });
    expect(s.status).toBe('playing');
    expect(s.round).toBe(2);

    // round 2 → resolve → nextRound (ahora debe pasar a gameEnd)
    s = step(s, { type: 'resolveRound', outcome: 'correct', remainingMs: 30_000 });
    s = step(s, { type: 'nextRound' });
    expect(s.status).toBe('gameEnd');
  });

  it('reset vuelve al initialSnapshot', () => {
    let s = step(initialSnapshot(), { type: 'pickCategory' });
    s = step(s, {
      type: 'startGame',
      payload: { category: 'musica', rng: () => 0 },
    });
    const reset = step(s, { type: 'reset' });
    expect(reset.status).toBe('idle');
    expect(reset.score).toBe(0);
  });

  it('acciones inválidas no mutan estado', () => {
    const s = step(initialSnapshot(), {
      type: 'resolveRound',
      outcome: 'correct',
      remainingMs: 30_000,
    });
    expect(s).toEqual(initialSnapshot());
  });

  it('runActions ejecuta secuencias completas', () => {
    const final = runActions([
      { type: 'pickCategory' },
      { type: 'startGame', payload: { category: 'futbol', totalRounds: 3, rng: () => 0 } },
      { type: 'resolveRound', outcome: 'correct', remainingMs: 25_000 },
      { type: 'nextRound' },
      { type: 'resolveRound', outcome: 'correct', remainingMs: 25_000 },
      { type: 'nextRound' },
      { type: 'resolveRound', outcome: 'correct', remainingMs: 25_000 },
      { type: 'nextRound' },
    ]);
    expect(final.status).toBe('gameEnd');
    expect(final.score).toBeGreaterThan(0);
    expect(final.rounds.length).toBe(3);
  });
});
