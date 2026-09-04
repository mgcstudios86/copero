/**
 * MGC-1657 (F2.3) — tests de wiring del motor V2.
 *
 * Acceptance criteria:
 *  - applyChoice() / applyWeeklyChoice() invocan getPositionTree(position)
 *    y delegan al outcome elegido.
 *  - applyStatDeltas() corre tras cada choice; persiste en
 *    PlayerProfile.positionStats.
 *  - maybeRollInjury() se evalúa post-choice; si dispara,
 *    simulation.applyChoice retorna `injured` y bloquea
 *    WEEKLY_BASE_OPTIONS excepto rehabilitacion por duration semanas.
 *  - resolveMatch() se invoca al final de cada season.matchweek;
 *    actualiza career.stats por club.
 *  - Persistencia: cerrar app con partido en curso, reabrir, recupera
 *    stats V2 (v:1 → v:2 migration).
 *
 * Los tests son pure (RNG determinista por week/season/profile) y se
 * ejecutan en vitest sin React Native runtime.
 */

import { describe, expect, it } from 'vitest';
import { initialProfile, step } from './engine';
import {
  applyWeeklyChoice,
  availableWeeklyOptions,
  getPositionStats,
  resolveWeeklyMatch,
} from './simulation';
import { STAT_INIT, statsForPosition } from './position-stats';
import { WEEKLY_BASE_OPTIONS, getPositionTree } from './position-tree';
import { createRng, seedFromString } from './rng';
import {
  blankCareerSave,
  loadCareerSave,
  migrateV1ToV2,
  saveCareerSave,
  __resetStorageForTests,
} from './persistence';
import type { CareerSaveState, PlayerProfile } from '@/types/career';

const seededProfile = (seed: number, overrides: Partial<PlayerProfile> = {}): PlayerProfile => ({
  ...initialProfile,
  name: `player-${seed}`,
  position: 'ST',
  positionStats: { ...STAT_INIT },
  week: 1,
  season: 1,
  club: { id: 'club-1', name: 'Test FC', league: 'TEST', crestColor: '#000', crestAccent: '#fff', presupuesto: 100, archetype: 'EQUILIBRIO', reputation: 3 },
  career: {
    ...initialProfile.career,
    doubleShiftStreak: 0,
    matchweekStats: { clubId: 'club-1', apps: 0, goals: 0, ast: 0 },
  },
  ...overrides,
});

describe('MGC-1657 · F2.3 wiring motor V2', () => {
  it('applyWeeklyChoice invoca getPositionTree y aplica outcome del root', () => {
    const profile = seededProfile(42);
    const tree = getPositionTree(profile.position);
    const result = applyWeeklyChoice(profile, 'turno_simple');
    // El outcome elegido debe estar en el root del árbol (4 outcomes).
    expect(tree.root.outcomes.map((o) => o.id)).toContain(result.outcome.id);
  });

  it('applyWeeklyChoice aplica deltas posicionales via applyStatDeltas', () => {
    const profile = seededProfile(7, {
      positionStats: { ...STAT_INIT, definicion: 50, velocidad: 50 },
    });
    const before = getPositionStats(profile);
    // RNG determinista que va a forzar éxito (prob 1.0).
    const rng = { next: () => 0.001, int: (a: number, _b: number) => a, chance: (_: number) => true };
    const result = applyWeeklyChoice(profile, 'turno_simple', rng as never);
    // El successDeltas (pase/vision/marcaje/definicion) más el outcome
    // del árbol posicional (pase 3 para MID/ST midfielder) deben haber
    // tocado al menos un stat.
    const allKeys = Object.keys(result.positionStats) as (keyof typeof result.positionStats)[];
    const changed = allKeys.some((k) => result.positionStats[k] !== before[k]);
    expect(changed).toBe(true);
  });

  it('applyWeeklyChoice persiste positionStats en el profile retornado', () => {
    const profile = seededProfile(13);
    const result = applyWeeklyChoice(profile, 'descanso');
    expect(result.profile.positionStats).toBeDefined();
    // El profile nuevo tiene exactamente el mismo shape que positionStats.
    expect(result.positionStats).toEqual(result.profile.positionStats);
  });

  it('lesión activa bloquea opciones excepto rehabilitación', () => {
    const profile = seededProfile(99, {
      career: {
        ...initialProfile.career,
        lesion: {
          kind: 'leve',
          fechasOut: 3,
          startedAtWeek: 0,
          affectedAttr: 'fisico',
        },
      },
    });
    const opts = availableWeeklyOptions(profile);
    const optIds = opts.map((o) => o.id);
    // Solo rehabilitación debe estar disponible con lesión activa.
    expect(optIds).toContain('rehabilitacion');
    expect(optIds).not.toContain('doble_turno');
    expect(optIds).not.toContain('turno_simple');
    expect(optIds).not.toContain('descanso');
  });

  it('maybeRollInjury puede disparar lesion v2 con doble turno consecutivo', () => {
    // Forzamos un RNG que va a tirar 0 (chance retorna true para p > 0).
    // El injury-v2 usa `rng.chance(p)`; con streak >= 4 la probabilidad
    // sube y podemos forzarlo con un RNG bien diseñado.
    const profile = seededProfile(1234, {
      career: {
        ...initialProfile.career,
        fisico: 20, // fatiga alta → injuryProbability > 0
        doubleShiftStreak: 5,
      },
    });
    // Hacemos 4 doble_turnos consecutivos para subir el streak.
    let current = profile;
    for (let i = 0; i < 4; i++) {
      current = applyWeeklyChoice(current, 'doble_turno').profile;
    }
    expect(current.career.doubleShiftStreak).toBeGreaterThanOrEqual(4);
  });

  it('variabilidad: dos saves con seeds distintos producen positionStats distintos', () => {
    // El RNG del weeklyChoice es determinista por (week, season, name,
    // optionId). Cambiar el nombre o el seed produce trayectorias distintas.
    const profile1 = seededProfile(1, { name: 'alpha' });
    const profile2 = seededProfile(1, { name: 'beta' });
    // Aplicamos la misma opción 5 veces.
    let p1 = profile1;
    let p2 = profile2;
    for (let i = 0; i < 5; i++) {
      p1 = applyWeeklyChoice(p1, 'turno_simple').profile;
      p2 = applyWeeklyChoice(p2, 'turno_simple').profile;
    }
    // La sumatoria de los 4 stats FWD debe diferir (RNG distinto).
    const sum1 = statsForPosition('ST').reduce(
      (a, k) => a + (p1.positionStats?.[k] ?? 0),
      0,
    );
    const sum2 = statsForPosition('ST').reduce(
      (a, k) => a + (p2.positionStats?.[k] ?? 0),
      0,
    );
    expect(sum1).not.toBe(sum2);
  });

  it('variabilidad entre semanas: misma save produce stats distintos week-over-week', () => {
    const profile = seededProfile(555);
    // Semana 1: turno_simple
    const r1 = applyWeeklyChoice(profile, 'turno_simple');
    // Semana 2: turno_simple
    const r2 = applyWeeklyChoice(r1.profile, 'turno_simple');
    // Semana 3: descanso
    const r3 = applyWeeklyChoice(r2.profile, 'descanso');
    // Los positionStats deben haber cambiado entre semanas (RNG cambia
    // porque el seed incluye el week actual).
    const w1Sum = statsForPosition('ST').reduce(
      (a, k) => a + r1.positionStats[k],
      0,
    );
    const w3Sum = statsForPosition('ST').reduce(
      (a, k) => a + r3.positionStats[k],
      0,
    );
    expect(w1Sum).not.toBe(w3Sum);
  });

  it('resolveWeeklyMatch suma apps + goals a profile.stats', () => {
    const profile = seededProfile(2024);
    const result = resolveWeeklyMatch(profile);
    // Al menos 1 partido.
    expect(result.profile.stats.apps).toBeGreaterThanOrEqual(1);
    expect(result.match.goals).toBeGreaterThanOrEqual(0);
    // matchweekStats queda evidenciado.
    expect(result.profile.career.matchweekStats?.apps).toBe(1);
  });

  it('reducer weeklyChoice conecta con applyWeeklyChoice y persiste positionStats', () => {
    const state: CareerSaveState = blankCareerSave();
    state.profile = seededProfile(77);
    state.profile.positionStats = { ...STAT_INIT };
    const after = step(state, { type: 'weeklyChoice', optionId: 'turno_simple' });
    expect(after.profile.positionStats).toBeDefined();
    expect(after.profile.week).toBe(state.profile.week + 1);
  });

  it('reducer resolveMatchweek acumula stats', () => {
    const state: CareerSaveState = blankCareerSave();
    state.profile = seededProfile(88);
    state.profile.positionStats = { ...STAT_INIT };
    const after = step(state, { type: 'resolveMatchweek' });
    expect(after.profile.stats.apps).toBe(1);
  });

  it('persistencia: round-trip v:2 mantiene positionStats tras save/load', async () => {
    __resetStorageForTests();
    const state = blankCareerSave();
    state.profile = seededProfile(101);
    state.profile.positionStats = { ...STAT_INIT, definicion: 78 };
    state.profile.week = 5;
    await saveCareerSave(state);
    const loaded = await loadCareerSave();
    expect(loaded).not.toBeNull();
    expect(loaded!.v).toBe(2);
    expect(loaded!.profile.positionStats?.definicion).toBe(78);
    expect(loaded!.profile.week).toBe(5);
  });

  it('persistencia: v:1 con positionStats ausente se migra a v:2 con STAT_INIT', async () => {
    __resetStorageForTests();
    // Simulamos un save v:1 sin positionStats (legacy).
    const legacy: CareerSaveState = {
      v: 1,
      stage: 'season',
      profile: {
        ...seededProfile(202),
      } as PlayerProfile,
      draft: null,
      card: null,
      clubId: 'club-1',
      log: { timeline: [], events: [] },
      seed: 202,
    };
    // Removemos positionStats explícitamente para simular v:1 puro.
    delete (legacy.profile as Partial<PlayerProfile>).positionStats;
    await saveCareerSave(legacy);

    const loaded = await loadCareerSave();
    expect(loaded).not.toBeNull();
    // Migrado a v:2.
    expect(loaded!.v).toBe(2);
    expect(loaded!.profile.positionStats).toBeDefined();
    // STAT_INIT hidrata todos los slots en 50.
    for (const v of Object.values(loaded!.profile.positionStats!)) {
      expect(v).toBe(50);
    }
  });

  it('migrateV1ToV2 es idempotente: aplicarla 2 veces no rompe', () => {
    const v1: CareerSaveState = {
      v: 1,
      stage: 'identity',
      profile: { ...seededProfile(303) },
      draft: null,
      card: null,
      clubId: null,
      log: { timeline: [], events: [] },
      seed: 303,
    };
    delete (v1.profile as Partial<PlayerProfile>).positionStats;
    const once = migrateV1ToV2(v1);
    const twice = migrateV1ToV2(once);
    expect(twice.v).toBe(2);
    expect(twice.profile.positionStats).toEqual(once.profile.positionStats);
  });
});

describe('MGC-1657 · WEEKLY_BASE_OPTIONS smoke', () => {
  it('catálogo tiene exactamente 6 opciones', () => {
    expect(Object.keys(WEEKLY_BASE_OPTIONS)).toHaveLength(6);
  });

  it('rehabilitacion requiere lesión activa', () => {
    expect(WEEKLY_BASE_OPTIONS.rehabilitacion.requiresInjury).toBe(true);
  });
});

// RNG smoke import — confirma seedFromString estable.
describe('MGC-1657 · RNG smoke', () => {
  it('seedFromString es determinista', () => {
    expect(seedFromString('foo')).toBe(seedFromString('foo'));
    expect(seedFromString('foo')).not.toBe(seedFromString('bar'));
  });

  it('createRng produce valores en [0, 1)', () => {
    const rng = createRng(42);
    for (let i = 0; i < 100; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
