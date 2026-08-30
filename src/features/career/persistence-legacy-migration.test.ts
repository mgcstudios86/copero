/**
 * Regresión MGC-399 — la migración legacy devolvía un `log` inválido.
 *
 * `migrateLegacyToV1` (MGC-385) construía `log: []` cuando el payload
 * legacy no traía `log`. Pero `CareerSaveState['log']` es `SeasonLog`
 * (`{ timeline, events }`), no un array: todo consumidor que leyera
 * `save.log.timeline` recibía `undefined` y explotaba. En web eso tiraba
 * el flujo `btn-career` de vuelta a `/simulador-carrera/identity` y
 * rompía 4 specs Playwright (home.spec :92, a11y-keyboard :68,
 * mgc444 :84 y :92). También rompía `tsc --noEmit` (TS2322/TS2352).
 *
 * `legacyState()` replica el shape exacto que siembran esos specs vía
 * `addInitScript` sobre la key `copero-career`.
 */

import { describe, it, expect } from 'vitest';
import { migrateLegacyToV1 } from './persistence';

/** `state` interno del payload zustand-persist que sembraban los specs. */
function legacyState(extra: Record<string, unknown> = {}) {
  return {
    stage: 'dashboard',
    profile: { name: 'Test Jugador', number: 9, position: 'ST' },
    ...extra,
  };
}

describe('MGC-399 · migrateLegacyToV1', () => {
  it('sin `log` en el payload legacy devuelve un SeasonLog vacío válido', () => {
    const save = migrateLegacyToV1(legacyState());

    expect(save?.stage).toBe('dashboard');
    expect(save?.log).toEqual({ timeline: [], events: [] });
    // El assert que fallaba antes del fix: `log` era `[]`, sin `.timeline`.
    expect(Array.isArray(save?.log.timeline)).toBe(true);
    expect(Array.isArray(save?.log.events)).toBe(true);
  });

  it('con `log` ya en shape SeasonLog lo preserva tal cual', () => {
    const timeline = [{ season: 1 }];
    const events = [{ season: 1, kind: 'debut', copyId: 'x' }];
    const save = migrateLegacyToV1(legacyState({ log: { timeline, events } }));

    expect(save?.log.timeline).toEqual(timeline);
    expect(save?.log.events).toEqual(events);
  });

  it('con `log` legacy como array plano lo mapea a `timeline`', () => {
    const seasons = [{ season: 1 }, { season: 2 }];
    const save = migrateLegacyToV1(legacyState({ log: seasons }));

    expect(save?.log.timeline).toEqual(seasons);
    expect(save?.log.events).toEqual([]);
  });

  it('con `log` basura (string / null) no rompe y devuelve SeasonLog vacío', () => {
    expect(migrateLegacyToV1(legacyState({ log: 'nope' }))?.log).toEqual({
      timeline: [],
      events: [],
    });
    expect(migrateLegacyToV1(legacyState({ log: null }))?.log).toEqual({
      timeline: [],
      events: [],
    });
  });

  it('devuelve null si falta `stage` o `profile` (no hay partida que migrar)', () => {
    expect(migrateLegacyToV1({ profile: { name: 'x' } })).toBeNull();
    expect(migrateLegacyToV1({ stage: 'dashboard' })).toBeNull();
  });

  it('emite `v: 1` para que loadCareerSave acepte el payload migrado', () => {
    expect(migrateLegacyToV1(legacyState())?.v).toBe(1);
  });
});
