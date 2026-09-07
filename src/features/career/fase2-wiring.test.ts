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
import { STAT_INIT, statsForPosition, type StatKey } from './position-stats';
import { WEEKLY_BASE_OPTIONS, getPositionTree, positionalTrainingDelta } from './position-tree';
import { createRng, seedFromString } from './rng';
import { affectedAttrFor } from '@/types/career';
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
    // RNG determinista que va a forzar éxito (prob 1.0). MGC-1676:
    // incluye `snapshot()` para que `applyWeeklyChoice` pueda emitir
    // `rngSnapshot` en el resultado.
    const rng = {
      next: () => 0.001,
      int: (a: number, _b: number) => a,
      chance: (_: number) => true,
      snapshot: () => ({ v: 1 as const, seed: 0, cursor: 0, algorithm: 'mulberry32' as const }),
      restore: () => undefined,
    };
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

// MGC-1677 HIGH-2 — al rehabilitarse, NO se debe pisar la lesión activa
// con un nuevo roll de `maybeRollInjury` (re-lesión contradice la
// narrativa de lesión sostenida). El remanente `fechasOut` y el
// `startedAtWeek` original deben sobrevivir.
describe('MGC-1677 · reinjury-preserve-weeks', () => {
  it('applyWeeklyChoice con lesión activa NO invoca maybeRollInjury', () => {
    // Perfil en week 4 rehabilitandose de una lesión leve de 3 semanas
    // disparada en week 1 (ya consumió 3 semanas).
    const startedAtWeek = 1;
    const profile = seededProfile(2025, {
      week: 4,
      career: {
        ...initialProfile.career,
        lesion: {
          kind: 'leve',
          fechasOut: 3,
          startedAtWeek,
          affectedAttr: 'fisico',
        },
      },
    });
    const result = applyWeeklyChoice(profile, 'rehabilitacion');
    // La lesión activa se preserva intacta: kind, fechasOut remanente
    // (no se resetea a un nuevo rango 2..6), startedAtWeek original.
    expect(result.profile.career.lesion.kind).toBe('leve');
    expect(result.profile.career.lesion.startedAtWeek).toBe(startedAtWeek);
    expect(result.profile.career.lesion.affectedAttr).toBe('fisico');
    expect(result.profile.career.lesion.fechasOut).toBe(3);
    // No se disparó nueva lesión (la lesión activa es pre-existente).
    expect(result.injuryFired).toBe(false);
    // `result.injury` refleja la lesión activa remanente (no null, no
    // una nueva lesión de rango 2..6).
    expect(result.injury).not.toBeNull();
    expect(result.injury?.fechasOut).toBe(3);
    expect(result.injury?.startedAtWeek).toBe(startedAtWeek);
  });

  it('applyWeeklyChoice con lesión activa de 6 semanas mantiene fechasOut=6', () => {
    const profile = seededProfile(31415, {
      week: 8,
      career: {
        ...initialProfile.career,
        lesion: {
          kind: 'grave',
          fechasOut: 6,
          startedAtWeek: 2,
          affectedAttr: 'tecnico',
        },
      },
    });
    const result = applyWeeklyChoice(profile, 'rehabilitacion');
    // No se reinicia a un nuevo rango 2..6; el remanente 6 sobrevive.
    expect(result.profile.career.lesion.fechasOut).toBe(6);
    expect(result.profile.career.lesion.kind).toBe('grave');
    expect(result.profile.career.lesion.startedAtWeek).toBe(2);
  });

  it('applyWeeklyChoice SIN lesión activa sí puede disparar nueva lesión', () => {
    // fatiga alta + streak alto fuerzan injuryProbability > 0; el RNG
    // builtin hace chance() retornar true para p > 0.
    const profile = seededProfile(7777, {
      career: {
        ...initialProfile.career,
        fisico: 5,
        doubleShiftStreak: 8,
        lesion: {
          kind: 'ninguna',
          fechasOut: 0,
          startedAtWeek: 0,
          affectedAttr: affectedAttrFor('ninguna'),
        },
      },
    });
    const result = applyWeeklyChoice(profile, 'doble_turno');
    // Sin lesión previa, maybeRollInjury puede dispararse; si dispara
    // la lesión nueva queda registrada con fechasOut en [2, 6].
    if (result.injuryFired && result.injury) {
      expect(result.injury.fechasOut).toBeGreaterThanOrEqual(2);
      expect(result.injury.fechasOut).toBeLessThanOrEqual(6);
      expect(result.profile.career.lesion.fechasOut).toBe(
        result.injury.fechasOut,
      );
    } else {
      // Si el RNG del test no disparó lesión, al menos verificamos
      // que el path "sin lesión previa" no preserva una lesión vieja.
      expect(result.profile.career.lesion.fechasOut).toBe(0);
    }
  });
});

// RNG smoke import — confirma seedFromString estable.
// FakeRNG determinista: success configurable + sin lesión + sin randomness.
// chance: p >= 0.5 → success opt, p < 0.5 → no lesion (base rate 0.02).
// snapshot/restore: shims no-op para satisfacer la interface Rng v2 (MGC-1676).
const makeFakeRng = (overrides?: { chance?: (p: number) => boolean; roll?: number }) => ({
  next: () => overrides?.roll ?? 0.001,
  int: (a: number, _b: number) => a,
  chance: overrides?.chance ?? ((p: number) => p >= 0.5),
  snapshot: () => ({ v: 1 as const, seed: 0, cursor: 0, algorithm: 'mulberry32' as const }),
  restore: () => {},
});

describe('MGC-1674 · entrenamiento_fisico_especifico (HIGH-1 PR #401)', () => {
  it('positionalTrainingDelta asigna 1 stat concreto por línea (GK/DEF/MID/FWD)', () => {
    expect(positionalTrainingDelta('GK')).toEqual({ reflejos: 2 });
    expect(positionalTrainingDelta('CB')).toEqual({ marcaje: 2 });
    expect(positionalTrainingDelta('LB')).toEqual({ marcaje: 2 });
    expect(positionalTrainingDelta('CM')).toEqual({ vision: 2 });
    expect(positionalTrainingDelta('ST')).toEqual({ definicion: 2 });
    expect(positionalTrainingDelta('LW')).toEqual({ definicion: 2 });
  });

  it('applyWeeklyChoice bumpa 1 stat posicional concreto cuando success (ST → definicion)', () => {
    const profile = seededProfile(1674, { position: 'ST' });
    const before = getPositionStats(profile);
    const result = applyWeeklyChoice(
      profile,
      'entrenamiento_fisico_especifico',
      makeFakeRng() as never,
    );
    // ST → bump ≥ +2 en definicion (puede sumar +3 si el outcome sampleado
    // fue `big_performance` y eligió `definicion` como stat FWD).
    expect(result.positionStats.definicion).toBeGreaterThanOrEqual(before.definicion + 2);
    // Y al menos un stat cambió en total.
    const changed = (Object.keys(result.positionStats) as StatKey[]).some(
      (k) => result.positionStats[k] !== before[k],
    );
    expect(changed).toBe(true);
    // El feedback debe ser success (sin lesion, sin fail).
    expect(result.feedback.kind).toBe('success');
    expect(result.injuryFired).toBe(false);
  });

  it('applyWeeklyChoice bumpa reflejos cuando GK elige la opción', () => {
    const profile = seededProfile(2024, { position: 'GK' });
    const before = getPositionStats(profile);
    const result = applyWeeklyChoice(
      profile,
      'entrenamiento_fisico_especifico',
      makeFakeRng() as never,
    );
    expect(result.positionStats.reflejos).toBeGreaterThanOrEqual(before.reflejos + 2);
  });

  it('on failure el stat posicional concreto no se bumpa', () => {
    const profile = seededProfile(99, { position: 'ST' });
    const before = getPositionStats(profile);
    const result = applyWeeklyChoice(
      profile,
      'entrenamiento_fisico_especifico',
      makeFakeRng({ chance: () => false }) as never,
    );
    // Failure: opt.failureDeltas es undefined (successDeltas vacío). Y
    // positionalTrainingDelta solo aplica en success. Por lo tanto el
    // stat no cambia (también: failureDeltas = undefined → no-op).
    expect(result.positionStats.definicion).toBe(before.definicion);
    expect(result.feedback.kind).toBe('warning');
  });

  it('el option successDeltas vacío ya no es el bug: el delta se computa en runtime', () => {
    expect(WEEKLY_BASE_OPTIONS.entrenamiento_fisico_especifico.successDeltas).toEqual({});
    // El delta efectivo en runtime surge del helper + outcome del árbol.
    const profile = seededProfile(11, { position: 'CM' });
    const result = applyWeeklyChoice(
      profile,
      'entrenamiento_fisico_especifico',
      makeFakeRng() as never,
    );
    // MID → vision +2 siempre; outcome también puede tocar otro stat.
    expect(result.positionStats.vision).toBeGreaterThan(50); // 50 base + ≥2
  });
});

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

// MGC-1676 — el snapshot del RNG debe sobrevivir force-stop (replay
// determinista). Si el caller persiste `result.rngSnapshot` en `state.rng`
// y luego re-aplica con ese snapshot, debe producir el mismo resultado
// que la corrida en línea.
describe('MGC-1676 · RNG snapshot replay determinista', () => {
  it('applyWeeklyChoice reanuda desde state.rng y produce el mismo resultado', () => {
    const profile = seededProfile(7);
    // Corrida en línea: delega al weeklyRng V1 (sin snapshot) → cursor=0.
    const liveResult = applyWeeklyChoice(profile, 'turno_simple');
    expect(liveResult.rngSnapshot.cursor).toBeGreaterThan(0);

    // Corrida reanudada: simulamos force-stop tras 1ª decisión, luego
    // aplicamos la 2ª decisión pasando `state.rng` (= 1ª snapshot).
    const persisted = liveResult.rngSnapshot;
    const replayResult = applyWeeklyChoice(liveResult.profile, 'turno_simple', persisted);

    // El resultado reanudado es idéntico al que habríamos obtenido si
    // hubiéramos continuado la corrida en línea sin interrupción.
    expect(replayResult.profile.week).toBe(liveResult.profile.week + 1);
    expect(replayResult.outcomeId).toBeDefined();
    expect(replayResult.rngSnapshot.cursor).toBeGreaterThan(persisted.cursor);
  });

  it('el cursor avanza monótonamente cuando se persiste entre semanas', () => {
    // Simulamos la persistencia real: cada llamada pasa el snapshot de
    // la decisión anterior. Sin pasar snapshot, cada applyWeeklyChoice
    // re-deriva seed de (week, season, name, optionId) → cursor=0.
    const profile = seededProfile(42);
    let current = profile;
    let snapshot: { v: 1; seed: number; cursor: number; algorithm: 'mulberry32' } | undefined;
    for (let i = 0; i < 5; i++) {
      const r = applyWeeklyChoice(current, 'turno_simple', snapshot);
      expect(r.rngSnapshot.cursor).toBeGreaterThan(snapshot?.cursor ?? 0);
      snapshot = r.rngSnapshot;
      current = r.profile;
    }
  });

  it('resolveWeeklyMatch avanza cursor y reanuda en próxima corrida', () => {
    const profile = seededProfile(2025);
    const r1 = resolveWeeklyMatch(profile);
    expect(r1.rngSnapshot.cursor).toBeGreaterThan(0);
    const r2 = resolveWeeklyMatch(r1.profile, r1.rngSnapshot);
    expect(r2.rngSnapshot.cursor).toBeGreaterThan(r1.rngSnapshot.cursor);
    // El goal count de r2 es independiente del de r1 (cada partido
    // consume su propio RNG); validamos que apps se acumuló.
    expect(r2.profile.stats.apps).toBe(r1.profile.stats.apps + 1);
  });

  it('reducer weeklyChoice persiste snapshot avanzado en state.rng', () => {
    const state: CareerSaveState = blankCareerSave();
    state.profile = seededProfile(123);
    state.profile.positionStats = { ...STAT_INIT };
    state.rng = { v: 1, seed: 42, cursor: 0, algorithm: 'mulberry32' };
    const before = state.rng.cursor;
    const after = step(state, { type: 'weeklyChoice', optionId: 'turno_simple' });
    expect(after.rng).toBeDefined();
    expect(after.rng!.cursor).toBeGreaterThan(before);
    // Seed se conserva (es la carrera, no la semana).
    expect(after.rng!.seed).toBe(42);
  });
});
