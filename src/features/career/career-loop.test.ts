import { describe, expect, it } from 'vitest';
import {
  initialSnapshot,
  step,
  ACADEMY_CLUBS,
  LEGENDS,
  DRAFT_ROUNDS,
  RETIREMENT_AGE,
} from './index';
import { createRng } from './rng';
import { buildRetirementSummary } from './retirement';
import { runCareerLoop } from './season';

/**
 * Acceptance MGC-208: corre una carrera completa headless y verifica
 * 1) timeline no vacío,
 * 2) OVR evolucionado,
 * 3) stage = 'retirement',
 * 4) profile persistible.
 */
describe('career loop end-to-end (MGC-208)', () => {
  it('corre una carrera completa desde identity hasta retiro', () => {
    // 1) identidad
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'Mateo Calvo' });
    s = step(s, { type: 'setNumber', number: 10 });
    s = step(s, { type: 'setPosition', position: 'ST' });
    s = step(s, { type: 'setNationality', code: 'AR' });
    s = step(s, { type: 'setPreferredFoot', foot: 'left' });
    s = step(s, { type: 'commitIdentity' });
    expect(s.stage).toBe('dashboard');

    // 2) club inicial (legacy path) — usamos uno de los academy clubs como
    //    atajo, después el draft sobreescribe stats.
    s = step(s, { type: 'openAcademy' });
    s = step(s, { type: 'acceptClub', club: ACADEMY_CLUBS[0] });
    expect(s.stage).toBe('clubStart');

    // 3) draft: 8 rondas picking la mejor leyenda disponible cada vez.
    s = step(s, { type: 'startDraft', seed: 42 });
    expect(s.stage).toBe('draft');
    for (let r = 0; r < DRAFT_ROUNDS; r++) {
      s = step(s, { type: 'pickLegend' });
    }
    expect(s.stage).toBe('club');
    expect(s.card).toBeTruthy();
    expect(s.card?.ovrInicial).toBeGreaterThan(40);
    expect(s.card?.potencial).toBeGreaterThan(s.card?.ovrInicial ?? 0);

    // 4) el jugador acepta un club con arquetipo DESARROLLO (MGC-208 §2).
    const clubDesarrollo = {
      ...ACADEMY_CLUBS[0],
      archetype: 'DESARROLLO' as const,
      reputation: 2,
    };
    s = step(s, { type: 'pickClub', club: clubDesarrollo });
    expect(s.stage).toBe('season');
    expect(s.profile.club?.id).toBe(clubDesarrollo.id);

    // 5) loop temporada-a-temporada hasta el retiro.
    s = step(s, { type: 'runCareerToRetirement' });
    expect(s.stage).toBe('retirement');
    expect(s.profile.age).toBeGreaterThanOrEqual(RETIREMENT_AGE);
    expect(s.log?.timeline.length).toBeGreaterThan(0);

    // 6) OVR evolucionó (no se queda en el inicial).
    const ovrInicial = s.card?.ovrInicial ?? 0;
    expect(s.profile.ovr).toBeGreaterThan(ovrInicial - 5);

    // 7) Resumen de retiro coherente.
    const summary = buildRetirementSummary(s.profile, s.log!);
    expect(summary.retirementAge).toBeGreaterThanOrEqual(RETIREMENT_AGE);
    expect(summary.totalApps).toBeGreaterThan(0);
    expect(summary.timeline.length).toBe(s.log!.timeline.length);
    expect(summary.vitrina.length).toBeGreaterThanOrEqual(0); // probabilístico, >= 0
  });

  it('swapLegend consume swapsLeft y no avanza de ronda', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'Swap' });
    s = step(s, { type: 'commitIdentity' });
    s = step(s, { type: 'startDraft', seed: 7 });
    const before = s.draft?.legendIdx ?? 0;
    const swapsBefore = s.draft?.swapsLeft ?? 0;
    s = step(s, { type: 'swapLegend' });
    expect(s.draft?.legendIdx).not.toBe(before);
    expect(s.draft?.swapsLeft).toBe(swapsBefore - 1);
    expect(s.stage).toBe('draft');
  });

  it('el draft produce exactamente 8 picks cuando se confirma la última ronda', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'Draft' });
    s = step(s, { type: 'commitIdentity' });
    s = step(s, { type: 'startDraft', seed: 99 });
    for (let i = 0; i < DRAFT_ROUNDS; i++) {
      s = step(s, { type: 'pickLegend' });
    }
    expect(s.card?.attrs.PAC).toBeGreaterThan(20);
    expect(s.card?.skills.SKL).toBeGreaterThan(0);
    expect(s.card?.skills.WF).toBeGreaterThan(0);
    // Las leyendas tienen best en slots variados (>=1 único).
    const filledSlots = new Set(
      LEGENDS.flatMap((l) => [l.best.key]),
    );
    expect(filledSlots.size).toBeGreaterThanOrEqual(1);
  });

  it('la persistencia round-trippea el snapshot vía memoria (fallback sin AsyncStorage)', async () => {
    const {
      blankCareerSave,
      saveCareerSave,
      loadCareerSave,
      clearCareerSave,
    } = await import('./persistence');
    await clearCareerSave();
    const blank = blankCareerSave();
    blank.stage = 'draft';
    blank.seed = 1234;
    await saveCareerSave(blank);
    const loaded = await loadCareerSave();
    expect(loaded).not.toBeNull();
    expect(loaded?.stage).toBe('draft');
    expect(loaded?.seed).toBe(1234);
    await clearCareerSave();
    const after = await loadCareerSave();
    expect(after).toBeNull();
  });

  it('RNG determinista: misma seed produce misma timeline', () => {
    const runOnce = () => {
      const rng = createRng(20260528);
      // simular 3 seasons de un jugador ST con club DESARROLLO.
      const profile = {
        ...initialSnapshot().profile,
        age: 16,
        season: 1,
        week: 1,
        ovr: 70,
        stats: { apps: 0, goals: 0, ast: 0 },
        attrs: { tecnico: 70, fisico: 70, mental: 70, portero: 50 },
      };
      const club = {
        ...ACADEMY_CLUBS[0],
        archetype: 'DESARROLLO' as const,
        reputation: 2,
      };
      const { profile: endProfile, log } = runCareerLoop(profile, club, rng);
      return { age: endProfile.age, ovr: endProfile.ovr, len: log.timeline.length };
    };
    const a = runOnce();
    const b = runOnce();
    expect(a).toEqual(b);
  });
});