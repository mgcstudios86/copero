/**
 * Tests del slot manager — MGC-490.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { PHASE_ORDER } from './bracket';
import {
  clearSlot,
  eliminateFromCup,
  getSlot,
  isSlotAvailable,
  resolveMatch,
  startSlot,
  subscribeSlot,
} from './slot';

const TEAMS_8 = Array.from({ length: 8 }, (_, i) => `T${i + 1}`);

describe('copero slot', () => {
  beforeEach(() => clearSlot());

  it('starts idle and reports availability', () => {
    expect(getSlot()).toBeNull();
    expect(isSlotAvailable()).toBe(true);
  });

  it('starts a slot with a generated bracket', () => {
    const slot = startSlot(TEAMS_8, 'unit-seed');
    expect(slot.status).toBe('inscribed');
    expect(slot.bracket.rounds.round_of_32).toHaveLength(4);
  });

  it('rejects double-start while active', () => {
    startSlot(TEAMS_8, 's');
    expect(() => startSlot(TEAMS_8, 's')).toThrow();
  });

  it('moves to in_progress on first result and notifies subscribers', () => {
    const events: number[] = [];
    const unsub = subscribeSlot((s) => events.push(s?.status === 'in_progress' ? 1 : 0));
    const slot = startSlot(TEAMS_8, 'notify');
    const m = slot.bracket.rounds.round_of_32[0];
    const winner = (m.home ?? m.away)!;
    const next = resolveMatch(m.id, winner);
    expect(next.status).toBe('in_progress');
    expect(events.some((v) => v === 1)).toBe(true);
    unsub();
  });

  it('transitions to won when bracket is complete', () => {
    const slot = startSlot(TEAMS_8, 'win');
    let cur = slot;
    for (const phase of PHASE_ORDER) {
      for (const m of cur.bracket.rounds[phase]) {
        if (m.winner) continue;
        const winner = (m.home ?? m.away)!;
        cur = resolveMatch(m.id, winner);
      }
    }
    expect(cur.status).toBe('won');
    expect(cur.champion).not.toBeNull();
  });

  it('can be cleared after elimination', () => {
    startSlot(TEAMS_8, 'e');
    eliminateFromCup();
    expect(getSlot()?.status).toBe('eliminated');
    clearSlot();
    expect(getSlot()).toBeNull();
    expect(isSlotAvailable()).toBe(true);
  });
});
