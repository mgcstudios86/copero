import { describe, expect, it } from 'vitest';
import { step, initialSnapshot, initialProfile, isIdentityComplete } from './engine';
import { POSITIONS } from './positions';
import { ACADEMY_CLUBS } from './clubs';
import { NATIONALITIES, NATIONALITIES_BY_CODE } from './nationalities';

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

  it('acceptClub fija club y avanza a clubStart', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'openAcademy' });
    expect(s.stage).toBe('academy');
    s = step(s, { type: 'acceptClub', club: ACADEMY_CLUBS[0] });
    expect(s.stage).toBe('clubStart');
    expect(s.profile.club?.id).toBe(ACADEMY_CLUBS[0].id);
  });

  it('reset vuelve al estado inicial', () => {
    let s = initialSnapshot();
    s = step(s, { type: 'setName', name: 'X' });
    s = step(s, { type: 'commitIdentity' });
    s = step(s, { type: 'reset' });
    expect(s).toEqual(initialSnapshot());
  });

  it('isIdentityComplete exige nombre de al menos 2 chars y número válido', () => {
    let s = initialSnapshot();
    expect(isIdentityComplete(s.profile)).toBe(false);
    s = step(s, { type: 'setName', name: 'M' });
    expect(isIdentityComplete(s.profile)).toBe(false);
    s = step(s, { type: 'setName', name: 'Ma' });
    expect(isIdentityComplete(s.profile)).toBe(true);
  });
});

describe('career fixtures', () => {
  it('POSITIONS cubre los 12 clickeables del field map', () => {
    expect(POSITIONS).toHaveLength(12);
    expect(new Set(POSITIONS.map((p) => p.id)).size).toBe(12);
  });

  it('ACADEMY_CLUBS tiene 3 ofertas (Vélez / Temperley / Morón)', () => {
    expect(ACADEMY_CLUBS).toHaveLength(3);
    const names = ACADEMY_CLUBS.map((c) => c.name);
    expect(names).toContain('Vélez Sarsfield');
    expect(names).toContain('Temperley');
    expect(names).toContain('Morón');
  });

  it('NATIONALITIES está indexada por código', () => {
    expect(NATIONALITIES.length).toBeGreaterThan(20);
    expect(NATIONALITIES_BY_CODE.AR.flag).toBeTruthy();
    expect(NATIONALITIES_BY_CODE.BR.name).toBe('Brasil');
  });
});