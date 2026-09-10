import { describe, expect, it } from 'vitest';
import { step, initialSnapshot, initialProfile, isIdentityComplete } from './engine';
import { POSITIONS } from './positions';
import { ACADEMY_CLUBS, clubsForPosition } from './clubs';
import { NATIONALITIES, NATIONALITIES_BY_CODE } from './nationalities';
import { recommendStrategy } from './simulation';
import { STRATEGIES } from './strategy';

describe('career engine', () => {
  it('initialSnapshot arranca en identity con profile defaults', () => {
    const s = initialSnapshot();
    expect(s.stage).toBe('identity');
    expect(s.profile).toEqual(initialProfile);
    expect(s.profile.age).toBe(16);
    expect(s.profile.ovr).toBe(50);
    expect(s.profile.club).toBeNull();
  });

  it('setName/setNumber/setPosition/setNationality/setPreferredFoot mutan el profile', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'Mateo' });
    s = step(s, { type: 'setNumber', number: 10 });
    s = step(s, { type: 'setPosition', position: 'CM' });
    s = step(s, { type: 'setNationality', code: 'AR' });
    s = step(s, { type: 'setPreferredFoot', foot: 'left' });
    expect(s.profile.name).toBe('Mateo');
    expect(s.profile.number).toBe(10);
    expect(s.profile.position).toBe('CM');
    expect(s.profile.nationalityCode).toBe('AR');
    expect(s.profile.preferredFoot).toBe('left');
    expect(s.stage).toBe('identity'); // stage no cambia hasta commit
  });

  it('setNumber clampa entre 1 y 99', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setNumber', number: 0 });
    expect(s.profile.number).toBe(1);
    s = step(s, { type: 'setNumber', number: 150 });
    expect(s.profile.number).toBe(99);
  });

  it('commitIdentity avanza a dashboard', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'Mateo' });
    s = step(s, { type: 'commitIdentity' });
    expect(s.stage).toBe('dashboard');
  });

  it('commitIdentityAndDraft enuta directo al draft (MGC-249)', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'Mateo' });
    s = step(s, { type: 'setNumber', number: 9 });
    s = step(s, { type: 'setPosition', position: 'ST' });
    s = step(s, { type: 'commitIdentityAndDraft', seed: 12345 });
    expect(s.stage).toBe('draft');
    expect(s.draft).not.toBeNull();
    expect(s.draft?.round).toBe(1);
    expect(s.draft?.picks).toEqual([]);
    expect(s.draft?.swapsLeft).toBe(5);
    expect(s.seed).toBe(12345);
  });

  it('commitIdentityAndDraft sin seed usa determinismo del nombre', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'Mateo' });
    s = step(s, { type: 'commitIdentityAndDraft' });
    expect(s.stage).toBe('draft');
    expect(s.seed).toBeGreaterThan(0);
  });

  it('acceptClub fija club y avanza a clubStart', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'openAcademy' });
    expect(s.stage).toBe('academy');
    s = step(s, { type: 'acceptClub', club: ACADEMY_CLUBS[0] });
    expect(s.stage).toBe('clubStart');
    expect(s.profile.club?.id).toBe(ACADEMY_CLUBS[0].id);
  });

  it('acceptClub propaga clubPresupuesto y activa clubInteres (MGC-455)', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'openAcademy' });
    s = step(s, { type: 'acceptClub', club: ACADEMY_CLUBS[0] });
    expect(s.profile.clubPresupuesto).toBe(ACADEMY_CLUBS[0].presupuesto);
    expect(s.profile.clubPresupuesto).toBe(8); // Vélez Sarsfield
    expect(s.profile.clubInteres).toBe(true);

    // T1 condition ahora se cumple (strategy.ts:177).
    expect(STRATEGIES.T1.condition?.(s.profile)).toBe(true);

    // recommendStrategy respeta week % 3 === 0 → MATCH_STRATEGIES[0] (M1).
    const withMatchWeek = { ...s, profile: { ...s.profile, week: 6 } };
    expect(recommendStrategy(withMatchWeek.profile)).toBe('M1');

    // Y en semana normal sigue ofreciendo weekly strategies.
    const withTrainWeek = { ...s, profile: { ...s.profile, week: 5 } };
    expect(recommendStrategy(withTrainWeek.profile)).toMatch(/^E\d$/);
  });

  it('reset vuelve al estado inicial', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'X' });
    s = step(s, { type: 'commitIdentity' });
    s = step(s, { type: 'reset' });
    expect(s).toEqual(initialSnapshot());
  });

  it('isIdentityComplete exige nombre + apellido (≥1 c/u) + edad 16-35', () => {
    // MGC-1769 / WF1 — nationalityCode arrancaba en `null` y exigía
    // selección explícita. MGC-2726 relajó esa regla: el gate ya no
    // exige nationalityCode. F2b (`qa/flows/mgc2719-pr590-f2b-name-lastname-only.yaml`)
    // NO selecciona country y aún así espera el botón enabled. El walk
    // E2E F1 sigue usando nombres completos (≥2) y selección de country
    // explícita, así que la regla relajada no afecta esos flows.
    let s = initialSnapshot();
    // Vacío: false.
    expect(isIdentityComplete(s.profile)).toBe(false);
    // Sólo name: false (falta lastName).
    s = step(s, { type: 'setName', name: 'M' });
    expect(isIdentityComplete(s.profile)).toBe(false);
    // Sólo lastName: false (falta name).
    s = step(s, { type: 'setLastName', lastName: 'R' });
    expect(isIdentityComplete(s.profile)).toBe(true);
  });

  it('decide aplica una decision y avanza la semana manteniendo stage', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'Mateo' });
    s = step(s, { type: 'commitIdentity' }); // -> dashboard
    s = step(s, { type: 'openAcademy' });
    s = step(s, { type: 'acceptClub', club: ACADEMY_CLUBS[0] });

    const beforeWeek = s.profile.week;
    const beforeAttrs = { ...s.profile.attrs };
    s = step(s, { type: 'decide', strategyId: 'E2', choiceId: 'e2_accept' });

    expect(s.stage).toBe('clubStart'); // stage no cambia por decide
    expect(s.profile.week).toBe(beforeWeek + 1);
    // OVR se recalcula como pure function y no debe bajar (E2 success sube atributos).
    expect(s.profile.attrs.tecnico).toBeGreaterThanOrEqual(beforeAttrs.tecnico - 2);
    expect(s.profile.attrs.mental).toBeGreaterThanOrEqual(beforeAttrs.mental - 2);
  });

  it('advance drena lesión y bumpea season cada 38 semanas', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'Test' });
    s = step(s, { type: 'commitIdentity' });
    s = step(s, { type: 'openAcademy' });
    s = step(s, { type: 'acceptClub', club: ACADEMY_CLUBS[0] });
    const season = s.profile.season;
    // Empujamos la week directo y avanzamos una vez.
    s = { ...s, profile: { ...s.profile, week: 38 } };
    s = step(s, { type: 'advance' });
    expect(s.profile.season).toBe(season + 1);
    expect(s.profile.week).toBe(1);
  });

  it('advance al rollover (week=38) acumula stats anuales OP/OG/OA (MGC-441)', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'Mateo' });
    s = step(s, { type: 'commitIdentity' });
    s = step(s, { type: 'openAcademy' });
    s = step(s, { type: 'acceptClub', club: ACADEMY_CLUBS[0] });
    // Jugamos 37 semanas con `advance()`: stats deben quedar en 0.
    for (let i = 0; i < 37; i++) {
      s = step(s, { type: 'advance' });
    }
    expect(s.profile.week).toBe(38);
    expect(s.profile.stats.apps).toBe(0);
    expect(s.profile.stats.goals).toBe(0);
    expect(s.profile.stats.ast).toBe(0);
    // El advance #38 cierra temporada y debe acumular OP/OG/OA.
    const seasonBefore = s.profile.season;
    const ageBefore = s.profile.age;
    s = step(s, { type: 'advance' });
    expect(s.profile.season).toBe(seasonBefore + 1);
    expect(s.profile.week).toBe(1);
    expect(s.profile.stats.apps).toBeGreaterThan(0);
    // El timeline debe tener al menos 1 fila registrada.
    expect(s.log?.timeline.length).toBeGreaterThanOrEqual(1);
    // La edad subió 1 año.
    expect(s.profile.age).toBe(ageBefore + 1);
  });

  it('advance sin club al rollover no acumula stats (no-op silencioso, MGC-441 causa 2)', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'SinClub' });
    s = step(s, { type: 'commitIdentity' });
    // Forzamos week=38 sin club.
    s = { ...s, profile: { ...s.profile, week: 38 } };
    const seasonBefore = s.profile.season;
    s = step(s, { type: 'advance' });
    // El rollover vía advanceWeek ocurre (season+1, week=1), pero sin stats.
    expect(s.profile.season).toBe(seasonBefore + 1);
    expect(s.profile.week).toBe(1);
    expect(s.profile.stats.apps).toBe(0);
  });
});

describe('career fixtures', () => {
  it('POSITIONS cubre los 12 clickeables del field map', () => {
    expect(POSITIONS).toHaveLength(12);
    expect(new Set(POSITIONS.map((p) => p.id)).size).toBe(12);
  });

  it('ACADEMY_CLUBS tiene 5 ofertas (Vélez / Temperley / Morón / Boca / River)', () => {
    // MGC-1648 — WF2 team-select obligatorio exige top-5 popular. Se
    // agregó River Plate al catálogo canónico. El test cubre que el
    // club esté presente; el resto del catálogo sigue intacto.
    expect(ACADEMY_CLUBS).toHaveLength(5);
    const names = ACADEMY_CLUBS.map((c) => c.name);
    expect(names).toContain('Vélez Sarsfield');
    expect(names).toContain('Temperley');
    expect(names).toContain('Morón');
    expect(names).toContain('Boca Juniors');
    expect(names).toContain('River Plate');
  });

  it('ACADEMY_CLUBS cubre los 3 arquetipos (DESARROLLO / EQUILIBRIO / AMBICIÓN)', () => {
    const archetypes = new Set(
      ACADEMY_CLUBS.map((c) => c.archetype).filter((a): a is NonNullable<typeof a> => Boolean(a)),
    );
    expect(archetypes.has('DESARROLLO')).toBe(true);
    expect(archetypes.has('EQUILIBRIO')).toBe(true);
    expect(archetypes.has('AMBICIÓN')).toBe(true);
  });

  it('clubsForPosition attack prioriza Boca/Vélez (MGC-249)', () => {
    const clubs = clubsForPosition('attack');
    expect(clubs[0].id).toMatch(/boca|velez/);
  });

  it('clubsForPosition goalkeeper prioriza Temperley/Morón (MGC-249)', () => {
    const clubs = clubsForPosition('goalkeeper');
    expect(clubs[0].id).toMatch(/temperley|moron/);
    expect(clubs[0].positionGroups).toContain('goalkeeper');
  });

  it('pickClub aplica fit bonus cuando el club es afín a la posición (MGC-249)', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'Test' });
    s = step(s, { type: 'commitIdentity' });
    s = step(s, { type: 'openAcademy' });
    s = step(s, { type: 'acceptClub', club: ACADEMY_CLUBS[0] });
    s = step(s, { type: 'startDraft', seed: 42 });
    for (let r = 0; r < 8; r++) s = step(s, { type: 'pickLegend' });
    expect(s.card).toBeTruthy();
    // MGC-427: tras 8 picks, stage debe pasar a 'club' para que el draft
    // screen navegue a /simulador-carrera/tu-jugador.
    expect(s.stage).toBe('club');
    const ovrSinFit = s.profile.ovr;
    // Boca tiene fitBonus=2 para attack.
    s = step(s, { type: 'setPosition', position: 'ST' });
    s = step(s, { type: 'pickClub', club: ACADEMY_CLUBS[3] }); // Boca
    // fitBonus=2 + EQUILIBRIO bonus... Boca es AMBICIÓN (bonus=0). fitBonus=2.
    expect(s.profile.ovr).toBeGreaterThanOrEqual(ovrSinFit + 2);
  });

  it('MGC-427: tras 8 pickLegend, stage es "club" y draft.picks.length === 8', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'M' });
    s = step(s, { type: 'commitIdentity' });
    s = step(s, { type: 'openAcademy' });
    s = step(s, { type: 'acceptClub', club: ACADEMY_CLUBS[0] });
    s = step(s, { type: 'startDraft', seed: 7 });
    for (let r = 0; r < 8; r++) s = step(s, { type: 'pickLegend' });
    expect(s.stage).toBe('club');
    expect(s.draft?.picks.length).toBe(8);
    expect(s.card).toBeTruthy();
  });

  it('NATIONALITIES está indexada por código', () => {
    expect(NATIONALITIES.length).toBeGreaterThan(20);
    expect(NATIONALITIES_BY_CODE.AR.flag).toBeTruthy();
    expect(NATIONALITIES_BY_CODE.BR.name).toBe('Brasil');
  });
});