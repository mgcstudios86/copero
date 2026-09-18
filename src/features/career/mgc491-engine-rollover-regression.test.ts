/**
 * MGC-491 — regression tests del fix edge case rollover.
 *
 * QA reportó (parent MGC-488) que al pulsar `btn-temporada-next-week`
 * (acción `advance`) 30+ veces los contadores OP/OG/OA quedaban en 0
 * mientras que `btn-temporada-play` (`advanceSeason` directo) sí
 * acumulaba. El fix de PR-184 (bbbeba0) introdujo la delegación desde
 * `case 'advance'` al helper de rollover, pero el código quedó con la
 * lógica duplicada en dos paths, dejando margen a drift entre el seed y
 * el merge del log.
 *
 * Esta suite fija el contrato:
 *
 *   1. `advance()` 1 vez NO acumula stats (granularidad semanal).
 *   2. `advance()` 38 veces = 1 rollover acumula stats anuales.
 *   3. `advance()` N*38 veces = N rollovers acumulan stats correctamente.
 *   4. `advance()` y `advanceSeason()` producen idéntica transición
 *      (timeline + stats + season + week) sobre el mismo snapshot.
 *   5. `advance()` sin club al rollover NO acumula stats (no-op para
 *      matches; el season/week/age sí rota via advanceWeek).
 *
 * Si alguno falla, hay drift entre los dos paths de rollover.
 */
import { describe, expect, it } from 'vitest';
import { applySeasonRollover, initialSnapshot, step } from './engine';
import { ACADEMY_CLUBS } from './clubs';

const setupWithClub = (name = 'Mateo') => {
  let s = initialSnapshot();
  s = step(s, { type: 'setName', name });
  s = step(s, { type: 'commitIdentity' });
  s = step(s, { type: 'openAcademy' });
  s = step(s, { type: 'acceptClub', club: ACADEMY_CLUBS[0] });
  return s;
};

describe('MGC-491 engine rollover edge case', () => {
  it('advance() 37 veces no acumula stats (granularidad semanal)', () => {
    const s0 = setupWithClub('Mateo');
    let s = s0;
    for (let i = 0; i < 37; i++) {
      s = step(s, { type: 'advance' });
    }
    expect(s.profile.week).toBe(38);
    expect(s.profile.stats.apps).toBe(0);
    expect(s.profile.stats.goals).toBe(0);
    expect(s.profile.stats.ast).toBe(0);
    expect(s.profile.season).toBe(1);
  });

  it('advance() 38 veces = 1 rollover acumula stats y avanza season', () => {
    let s = setupWithClub('Mateo');
    for (let i = 0; i < 38; i++) {
      s = step(s, { type: 'advance' });
    }
    expect(s.profile.season).toBe(2);
    expect(s.profile.week).toBe(1);
    expect(s.profile.stats.apps).toBeGreaterThan(0);
    expect(s.log?.timeline.length).toBe(1);
    // La edad subió exactamente 1 año (un rollover).
    expect(s.profile.age).toBe(17);
  });

  it('advance() 76 veces = 2 rollovers, stats acumuladas temporada a temporada', () => {
    let s = setupWithClub('Doble');
    for (let i = 0; i < 76; i++) {
      s = step(s, { type: 'advance' });
    }
    expect(s.profile.season).toBe(3);
    expect(s.profile.week).toBe(1);
    expect(s.log?.timeline.length).toBe(2);
    expect(s.profile.stats.apps).toBeGreaterThanOrEqual(16);
    expect(s.profile.age).toBe(18);
  });

  it('advance() 228 veces = 6 rollovers (caso QA, Jugar temporada equivalente)', () => {
    let s = setupWithClub('Rapido');
    for (let i = 0; i < 228; i++) {
      s = step(s, { type: 'advance' });
    }
    expect(s.profile.season).toBe(7);
    expect(s.profile.week).toBe(1);
    expect(s.log?.timeline.length).toBe(6);
    // 6 temporadas * mínimo 8 apps por temporada = 48.
    expect(s.profile.stats.apps).toBeGreaterThanOrEqual(48);
    expect(s.profile.stats.goals + s.profile.stats.ast).toBeGreaterThan(0);
  });

  it('advance() y advanceSeason() producen la misma transición sobre el mismo snapshot', () => {
    // Construimos el snapshot de partida idéntico dos veces con
    // week=38 (perímetro del rollover) y aplicamos un path distinto.
    // Sin el helper compartido (MGC-491), los dos paths duplicaban
    // cálculo de seed y merge del log, y un drift accidental podría
    // divergir las stats. Este test pinea ambos outputs a ser
    // idénticos.
    const a = setupWithClub('Igual');
    const b = setupWithClub('Igual');
    const atRollover = (s: typeof a) => ({ ...s, profile: { ...s.profile, week: 38 } });
    const afterAdvance = step(atRollover(a), { type: 'advance' });
    const afterAdvanceSeason = step(atRollover(b), { type: 'advanceSeason' });
    expect(afterAdvance.profile.stats).toEqual(afterAdvanceSeason.profile.stats);
    expect(afterAdvance.profile.season).toBe(afterAdvanceSeason.profile.season);
    expect(afterAdvance.profile.week).toBe(afterAdvanceSeason.profile.week);
    expect(afterAdvance.profile.age).toBe(afterAdvanceSeason.profile.age);
    expect(afterAdvance.log?.timeline.length).toBe(afterAdvanceSeason.log?.timeline.length);
    expect(afterAdvance.stage).toBe(afterAdvanceSeason.stage);
  });

  it('advance() sin club al rollover NO acumula stats (no-op silencioso)', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'SinClub' });
    s = step(s, { type: 'commitIdentity' });
    s = { ...s, profile: { ...s.profile, week: 38 } };
    const seasonBefore = s.profile.season;
    s = step(s, { type: 'advance' });
    expect(s.profile.season).toBe(seasonBefore + 1);
    expect(s.profile.week).toBe(1);
    expect(s.profile.stats.apps).toBe(0);
  });

  it('applySeasonRollover sin club es no-op (helper compartido)', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'SinClub2' });
    s = step(s, { type: 'commitIdentity' });
    const before = { ...s };
    const after = applySeasonRollover(s);
    expect(after.profile.club).toBeNull();
    expect(after.profile.stats).toEqual(before.profile.stats);
    expect(after.log?.timeline.length).toBe(before.log?.timeline.length ?? 0);
  });

  // MGC-487.3 — vitrina temporada-a-temporada. AC:
  //   1. `applySeasonRollover` agrega una `SeasonHistoryEntry` por
  //      temporada cerrada (campeón = club del jugador, MVP = el
  //      propio jugador, subcampeón determinista).
  //   2. La entrada aparece en `state.history` con la misma `season`
  //      que `result.profile.season` después del rollover.
  //   3. N rollovers → N entries, todas con `season` estrictamente
  //      creciente y `closedAt` ISO válido.
  it('MGC-487.3 — rollover persiste history[] con campeón + subcampeón + MVP', () => {
    const s0 = setupWithClub('Vitrina');
    const afterFirst = applySeasonRollover(s0);
    expect(Array.isArray(afterFirst.history)).toBe(true);
    expect(afterFirst.history?.length).toBe(1);
    const entry = afterFirst.history![0];
    expect(entry.season).toBe(afterFirst.profile.season);
    expect(entry.champion.clubId).toBe(s0.profile.club!.id);
    expect(entry.champion.clubName).toBe(s0.profile.club!.name);
    expect(entry.runnerUp.clubId).not.toBe(entry.champion.clubId);
    expect(entry.mvp.name).toBe('Vitrina');
    expect(typeof entry.closedAt).toBe('string');
    // ISO 8601 parseable.
    expect(Number.isFinite(Date.parse(entry.closedAt))).toBe(true);
  });

  it('MGC-487.3 — múltiples rollovers acumulan history[] sin pisar', () => {
    let s = setupWithClub('Acum');
    s = applySeasonRollover(s);
    const firstSeason = s.profile.season;
    s = applySeasonRollover(s);
    s = applySeasonRollover(s);
    expect(s.history?.length).toBe(3);
    // seasons crecientes y todas distintas.
    const seasons = s.history!.map((h) => h.season);
    expect(new Set(seasons).size).toBe(3);
    expect(seasons[0]).toBe(firstSeason);
    expect(seasons[2]).toBe(firstSeason + 2);
    // cada entry referencia al club del jugador al momento del cierre
    // (en este test el club no cambia entre rollovers).
    s.history!.forEach((h) => {
      expect(h.champion.clubId).toBe(s.profile.club!.id);
    });
  });

  it('MGC-487.3 — rollover sobre state sin history[] no rompe (default [])', () => {
    const s0 = setupWithClub('Legacy');
    // Simulamos un save pre-MGC-487.3 (history undefined).
    const sNoHistory: typeof s0 = { ...s0, history: undefined };
    const after = applySeasonRollover(sNoHistory);
    expect(Array.isArray(after.history)).toBe(true);
    expect(after.history?.length).toBe(1);
  });
});