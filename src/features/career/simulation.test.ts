import { describe, expect, it } from 'vitest';
import {
  applyChoice,
  advanceWeek,
  eventFromStrategy,
  recommendStrategy,
  setInjury,
} from './simulation';
import { createRng, seedFromString } from './rng';
import { recomputeOvrForPosition, recomputeReputation } from './reputation';
import { STRATEGIES, strategyCopy } from './strategy';
import { initialProfile } from './engine';
import type { PlayerProfile, StrategyId } from '@/types/career';

/** Fixture determinista con overrides parciales. */
function profileFixture(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    ...initialProfile,
    ...overrides,
    attrs: { ...initialProfile.attrs, ...(overrides.attrs ?? {}) },
    career: {
      ...initialProfile.career,
      ...(overrides.career ?? {}),
      reputation: {
        ...initialProfile.career.reputation,
        ...(overrides.career?.reputation ?? {}),
      },
      lesion: overrides.career?.lesion ?? initialProfile.career.lesion,
    },
  };
}

describe('rng determinista', () => {
  it('mismo seed → misma secuencia', () => {
    const a = createRng(seedFromString('copero-mgc-442'));
    const b = createRng(seedFromString('copero-mgc-442'));
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('chance(0) siempre false y chance(1) siempre true', () => {
    const r = createRng(42);
    for (let i = 0; i < 50; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });

  it('int respeta min/max inclusivos', () => {
    const r = createRng(7);
    for (let i = 0; i < 100; i++) {
      const v = r.int(5, 9);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(9);
    }
  });
});

describe('reputation pure function', () => {
  it('moral >= 75 → prensa ensalzada', () => {
    const rep = recomputeReputation(
      { ...initialProfile.career, moral: 80 },
      { ovr: 70, age: 24, week: 3 },
    );
    expect(rep.prensa).toBe('ensalzada');
  });

  it('moral <= 24 → prensa hostil', () => {
    const rep = recomputeReputation(
      { ...initialProfile.career, moral: 20 },
      { ovr: 70, age: 24, week: 6 },
    );
    expect(rep.prensa).toBe('hostil');
  });

  it('racha + moral altos → hinchada idolo', () => {
    const rep = recomputeReputation(
      { ...initialProfile.career, racha: 6, moral: 80 },
      { ovr: 70, age: 24, week: 2 },
    );
    expect(rep.hinchada).toBe('idolo');
  });

  it('selección convocada solo con OVR >= 80 y edad válida', () => {
    const joven = recomputeReputation(
      { ...initialProfile.career, racha: 5, moral: 80 },
      { ovr: 85, age: 17, week: 2 },
    );
    expect(joven.seleccionConvocado).toBe(false);
    const mayor = recomputeReputation(
      { ...initialProfile.career, racha: 5, moral: 80 },
      { ovr: 85, age: 25, week: 2 },
    );
    expect(mayor.seleccionConvocado).toBe(true);
  });

  // MGC-1705 — boundary tests para normalización 0-indexed del ciclo
  // prensa (weekIdx % 3 === 2). Semana 1 (weekIdx=0) no es prensa-active,
  // semanas 3 y 6 (weekIdx=2, 5) sí lo son.
  it('semana 1 (weekIdx=0): prensa neutral, no es semana de prensa', () => {
    const rep = recomputeReputation(
      { ...initialProfile.career, moral: 80 },
      { ovr: 70, age: 24, week: 1 },
    );
    expect(rep.prensa).toBe('neutral');
  });

  it('semana 3 (weekIdx=2): prensa refleja moral (ciclo match)', () => {
    const rep = recomputeReputation(
      { ...initialProfile.career, moral: 80 },
      { ovr: 70, age: 24, week: 3 },
    );
    expect(rep.prensa).toBe('ensalzada');
  });

  it('semana 6 (weekIdx=5): prensa refleja moral (ciclo consistente)', () => {
    const rep = recomputeReputation(
      { ...initialProfile.career, moral: 20 },
      { ovr: 70, age: 24, week: 6 },
    );
    expect(rep.prensa).toBe('hostil');
  });
});

describe('recomputeOvrForPosition', () => {
  it('GK pondera portero', () => {
    const ovr = recomputeOvrForPosition('GK', { tecnico: 50, fisico: 50, mental: 50, portero: 90 });
    expect(ovr).toBeGreaterThanOrEqual(60);
  });

  it('campo excluye portero', () => {
    const ovr = recomputeOvrForPosition('ST', { tecnico: 80, fisico: 70, mental: 60, portero: 10 });
    expect(ovr).toBeGreaterThan(60);
  });

  it('clamp 0..99', () => {
    expect(recomputeOvrForPosition('CM', { tecnico: 99, fisico: 99, mental: 99, portero: 99 })).toBeLessThanOrEqual(99);
    expect(recomputeOvrForPosition('CM', { tecnico: 0, fisico: 0, mental: 0, portero: 0 })).toBeGreaterThanOrEqual(0);
  });
});

describe('eventFromStrategy', () => {
  it('E1 devuelve title, feedback y choices sin copy hardcoded', () => {
    const ev = eventFromStrategy('E1', profileFixture());
    expect(ev.strategyId).toBe('E1');
    expect(ev.title).toBe('training_e1_title');
    expect(ev.choices.length).toBeGreaterThan(0);
    expect(ev.choices[0].copyId).toBe('training_e1_option');
  });

  it('T1 sin clubInteres → 0 choices', () => {
    const p = profileFixture();
    // baseline: career.reputation.seleccionConvocado=false y club=null (sin presupuesto)
    const ev = eventFromStrategy('T1', p);
    expect(ev.choices).toHaveLength(0);
  });

  it('V3 sin racha negativa → 0 choices (condition no se cumple)', () => {
    const p = profileFixture({ career: { ...initialProfile.career, racha: 0, moral: 60 } });
    const ev = eventFromStrategy('V3', p);
    expect(ev.choices).toHaveLength(0);
  });
});

describe('applyChoice determinismo', () => {
  it('mismo seed → mismos stats resultantes', () => {
    const seed = seedFromString('fixture-1');
    const p1 = profileFixture({ week: 3, season: 1 });
    const p2 = profileFixture({ week: 3, season: 1 });
    const r1 = applyChoice(p1, 'E2', 'e2_accept', createRng(seed));
    const r2 = applyChoice(p2, 'E2', 'e2_accept', createRng(seed));
    expect(r1.profile.career.moral).toBe(r2.profile.career.moral);
    expect(r1.profile.career.fisico).toBe(r2.profile.career.fisico);
    expect(r1.profile.attrs.tecnico).toBe(r2.profile.attrs.tecnico);
    expect(r1.profile.attrs.mental).toBe(r2.profile.attrs.mental);
  });

  it('E4 (descanso) siempre exitoso: sube físico', () => {
    const p = profileFixture({ career: { ...initialProfile.career, fisico: 30 } });
    const r = applyChoice(p, 'E4', 'e4_accept', createRng(0));
    expect(r.profile.career.fisico).toBe(48);
  });

  it('M1 conservadora: baja físico, sube moral', () => {
    const p = profileFixture();
    const r = applyChoice(p, 'M1', 'm1_conservadora', createRng(0));
    expect(r.profile.career.fisico).toBe(initialProfile.career.fisico - 10);
    expect(r.profile.career.moral).toBe(initialProfile.career.moral + 3);
  });

  it('clamping: moral no pasa de 100', () => {
    const p = profileFixture({ career: { ...initialProfile.career, moral: 99 } });
    const r = applyChoice(p, 'M1', 'm1_lider', createRng(0));
    expect(r.profile.career.moral).toBeLessThanOrEqual(100);
  });

  it('feedback incluye copyId del matrix (sin strings hardcoded)', () => {
    const p = profileFixture();
    const r = applyChoice(p, 'E2', 'e2_accept', createRng(1));
    expect(r.feedback.copyId).toMatch(/^feedback_/);
    expect(['success', 'warning', 'danger', 'neutral']).toContain(r.feedback.kind);
  });
});

describe('advanceWeek', () => {
  it('drena lesión hasta cero y resetea kind', () => {
    const lesionado = setInjury(profileFixture(), 'leve', 2);
    const r = advanceWeek(lesionado);
    expect(r.career.lesion.fechasOut).toBe(1);
    expect(r.career.lesion.kind).toBe('leve');
    const r2 = advanceWeek(r);
    expect(r2.career.lesion.fechasOut).toBe(0);
    expect(r2.career.lesion.kind).toBe('ninguna');
  });

  it('bumpea season cada 38 semanas', () => {
    const r = advanceWeek(profileFixture({ week: 38 }));
    expect(r.season).toBe(2);
    expect(r.week).toBe(1);
    expect(r.age).toBe(17);
  });
});

describe('recommendStrategy', () => {
  it('devuelve E* en semana normal', () => {
    const id = recommendStrategy(profileFixture({ week: 5 }));
    expect(id).toMatch(/^E\d$/);
  });

  it('V1 si racha >= 3', () => {
    const p = profileFixture({ career: { ...initialProfile.career, racha: 4 } });
    expect(recommendStrategy(p)).toBe('V1');
  });

  it('L1 cuando lesionado leve', () => {
    const p = profileFixture({
      career: {
        ...initialProfile.career,
        lesion: { kind: 'leve', fechasOut: 1, startedAtWeek: 1, affectedAttr: 'fisico' },
      },
    });
    expect(recommendStrategy(p)).toBe('L1');
  });

  it('L2 cuando lesionado medio', () => {
    const p = profileFixture({
      career: {
        ...initialProfile.career,
        lesion: { kind: 'media', fechasOut: 2, startedAtWeek: 1, affectedAttr: 'mental' },
      },
    });
    expect(recommendStrategy(p)).toBe('L2');
  });

  it('L3 cuando lesionado grave', () => {
    const p = profileFixture({
      career: {
        ...initialProfile.career,
        lesion: { kind: 'grave', fechasOut: 4, startedAtWeek: 1, affectedAttr: 'tecnico' },
      },
    });
    expect(recommendStrategy(p)).toBe('L3');
  });

  // MGC-1664 — boundary checks tras normalizar week index a 0-indexed.
  it('semana 1 → WEEKLY[0]=E1 (no salta E1 por off-by-one)', () => {
    expect(recommendStrategy(profileFixture({ week: 1 }))).toBe('E1');
  });

  it('semana 3 → MATCH_STRATEGIES[0]=M1 (cada 3 semanas desde 0-indexed)', () => {
    expect(recommendStrategy(profileFixture({ week: 3 }))).toBe('M1');
  });

  it('semana 6 → MATCH_STRATEGIES[0]=M1 (ciclo match consistente)', () => {
    expect(recommendStrategy(profileFixture({ week: 6 }))).toBe('M1');
  });

  it('semana 5 → WEEKLY[4]=E5 (último weekly antes de match en week 6)', () => {
    expect(recommendStrategy(profileFixture({ week: 5 }))).toBe('E5');
  });

  it('semana 38 (boundary season end) → weekly, no match', () => {
    const id = recommendStrategy(profileFixture({ week: 38 }));
    expect(id).toMatch(/^E\d$/);
  });
});

describe('cobertura del catálogo E1-V7', () => {
  it('todos los StrategyId están definidos en STRATEGIES', () => {
    const required: StrategyId[] = [
      'E1','E2','E3','E4','E5','M1','M2','M3','M4','M5','T1','T2','T3','T4','L1','L2','L3','R1','R2','R3','R4','O1','O2','O3','O4','V1','V2','V3','V4','V5','V6','V7',
    ];
    for (const id of required) {
      expect(STRATEGIES[id]).toBeDefined();
      expect(STRATEGIES[id].options.length).toBeGreaterThan(0);
    }
  });

  it('cada option tiene feedback.success definido', () => {
    for (const id of Object.keys(STRATEGIES) as StrategyId[]) {
      for (const opt of STRATEGIES[id].options) {
        expect(opt.feedback.success).toMatch(/^feedback_/);
      }
    }
  });
});

describe('MGC-451 H1 — E1 stats coherentes con copy', () => {
  it('E1 success neta +1 físico (no -11)', () => {
    const opt = STRATEGIES.E1.options[0];
    const net = opt.success.reduce((acc, d) => acc + d.delta, 0);
    expect(net).toBe(1);
    expect(opt.success.every((d) => d.field === 'fisico')).toBe(true);
  });

  it('E1 failure neta -8 físico', () => {
    const opt = STRATEGIES.E1.options[0];
    expect(opt.failure).toBeDefined();
    const net = opt.failure!.reduce((acc, d) => acc + d.delta, 0);
    expect(net).toBe(-8);
  });

  it('applyChoice E1 success aplica +1 al físico del profile', () => {
    const p = profileFixture({ career: { ...initialProfile.career, fisico: 50 } });
    const before = p.career.fisico;
    const r = applyChoice(p, 'E1', 'e1_accept', createRng(0));
    // Forzamos success vía prob=1 no aplica acá (prob=0.8), pero la opción
    // success solo tiene +1; failure solo tiene -8. Verificamos que el delta
    // neto de la opción es exactamente +1 o -8 (no otro valor).
    const opt = STRATEGIES.E1.options[0];
    const sum = (arr: { delta: number }[]) => arr.reduce((acc, d) => acc + d.delta, 0);
    expect(Math.abs(sum(opt.success))).toBe(1);
    expect(Math.abs(sum(opt.failure!))).toBe(8);
    // Smoke: el físico resultante está en [before-8, before+1].
    expect(r.profile.career.fisico).toBeGreaterThanOrEqual(before - 8);
    expect(r.profile.career.fisico).toBeLessThanOrEqual(before + 1);
  });
});

describe('MGC-451 H4 — strategyCopy helper', () => {
  it('devuelve title y body para E1', () => {
    const c = strategyCopy('E1');
    expect(c.title).toBe('training_e1_title');
    expect(c.body).toBe('training_e1_body');
  });

  it('devuelve title y body para L1 (prefijo injury_)', () => {
    const c = strategyCopy('L1');
    expect(c.title).toBe('injury_l1_title');
    expect(c.body).toBe('injury_l1_body');
  });

  it('M3 no tiene body (acepta undefined)', () => {
    const c = strategyCopy('M3');
    expect(c.title).toBe('match_m3_title');
    expect(c.body).toBeUndefined();
  });

  it('cada strategyId tiene title definido', () => {
    const ids = Object.keys(STRATEGIES) as StrategyId[];
    for (const id of ids) {
      expect(strategyCopy(id).title).toBeTruthy();
    }
  });
});

describe('MGC-451 H5 — seed RNG categórico (sin colisión E1..E5)', () => {
  it('seeds distintos para E1..E5 (categoría training)', () => {
    const seeds = new Set(['E1','E2','E3','E4','E5'].map((id) => seedFromString(id)));
    expect(seeds.size).toBe(5);
  });

  it('seeds distintos para M1..M5 (categoría match)', () => {
    const seeds = new Set(['M1','M2','M3','M4','M5'].map((id) => seedFromString(id)));
    expect(seeds.size).toBe(5);
  });

  it('applyChoice con seed estable por strategyId completo', () => {
    const p1 = profileFixture({ week: 3, season: 1 });
    const p2 = profileFixture({ week: 3, season: 1 });
    const r1 = applyChoice(p1, 'E2', 'e2_accept');
    const r2 = applyChoice(p2, 'E2', 'e2_accept');
    expect(r1.profile.career.fisico).toBe(r2.profile.career.fisico);
    expect(r1.profile.attrs.tecnico).toBe(r2.profile.attrs.tecnico);
  });
});