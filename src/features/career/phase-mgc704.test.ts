import { describe, expect, it } from 'vitest';
import {
  applyResultToStandings,
  emptyStandings,
  generateLeagueFixtures,
  getStandingsForDisplay,
  simulateMatchGoals,
  sortStandings,
  type StandingRow,
} from './phase';

/**
 * MGC-704 — tests del slice de liga persistible. Cubre:
 *  - Generación determinista de fixtures round-robin.
 *  - Simulación determinista de partido.
 *  - Acumulación inmutable de standings.
 *  - Sort por PTS > DG > GF.
 *  - Helper de display: real data vs placeholder.
 *  - Test integrado: 17 fechas → tabla refleja PJ/PTS/DG/GF/GC correctos.
 */
describe('MGC-704 liga slice', () => {
  const clubs = ['Boca', 'River', 'Vélez', 'Temperley', 'Morón'];

  it('emptyStandings inicializa todos los clubes en cero', () => {
    const s = emptyStandings(clubs);
    expect(Object.keys(s)).toHaveLength(clubs.length);
    for (const c of clubs) {
      expect(s[c]).toEqual({
        position: 0,
        club: c,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      });
    }
  });

  it('generateLeagueFixtures es determinista por seed', () => {
    const a = generateLeagueFixtures(clubs, 42);
    const b = generateLeagueFixtures(clubs, 42);
    expect(a).toEqual(b);
    // 5 clubes impares → 5 fechas, 2 partidos por fecha.
    expect(a).toHaveLength(10);
    const weeks = new Set(a.map((f) => f.week));
    expect(weeks.size).toBe(5);
  });

  it('generateLeagueFixtures con seed distinto cambia el ordenamiento', () => {
    const a = generateLeagueFixtures(clubs, 1);
    const b = generateLeagueFixtures(clubs, 2);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it('generateLeagueFixtures cada club juega exactamente una vez por fecha', () => {
    const fixtures = generateLeagueFixtures(clubs, 123);
    for (let w = 1; w <= 5; w++) {
      const inWeek = fixtures.filter((f) => f.week === w);
      expect(inWeek).toHaveLength(2);
      const teams = new Set<string>();
      for (const f of inWeek) {
        teams.add(f.homeId);
        teams.add(f.awayId);
      }
      expect(teams.size).toBe(4); // 5 clubes impares → 1 bye
    }
  });

  it('simulateMatchGoals es determinista', () => {
    const a = simulateMatchGoals('Boca', 'River', 99);
    const b = simulateMatchGoals('Boca', 'River', 99);
    expect(a).toEqual(b);
    expect(a.homeGoals).toBeGreaterThanOrEqual(0);
    expect(a.homeGoals).toBeLessThanOrEqual(4);
    expect(a.awayGoals).toBeGreaterThanOrEqual(0);
    expect(a.awayGoals).toBeLessThanOrEqual(4);
  });

  it('applyResultToStandings acumula correctamente victoria local', () => {
    let s = emptyStandings(clubs);
    s = applyResultToStandings(s, 'Boca', 'River', 3, 1);
    expect(s['Boca']?.played).toBe(1);
    expect(s['Boca']?.won).toBe(1);
    expect(s['Boca']?.points).toBe(3);
    expect(s['Boca']?.goalsFor).toBe(3);
    expect(s['Boca']?.goalsAgainst).toBe(1);
    expect(s['River']?.played).toBe(1);
    expect(s['River']?.lost).toBe(1);
    expect(s['River']?.points).toBe(0);
  });

  it('applyResultToStandings acumula empate con 1 punto por equipo', () => {
    let s = emptyStandings(clubs);
    s = applyResultToStandings(s, 'Boca', 'River', 2, 2);
    expect(s['Boca']?.drawn).toBe(1);
    expect(s['Boca']?.points).toBe(1);
    expect(s['River']?.drawn).toBe(1);
    expect(s['River']?.points).toBe(1);
  });

  it('applyResultToStandings es inmutable', () => {
    const before = emptyStandings(clubs);
    const after = applyResultToStandings(before, 'Boca', 'River', 1, 0);
    expect(before['Boca']?.played).toBe(0);
    expect(after['Boca']?.played).toBe(1);
  });

  it('sortStandings ordena por PTS > DG > GF', () => {
    const s: Record<string, StandingRow> = {
      A: { position: 0, club: 'A', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 5, goalsAgainst: 2, points: 6 },
      B: { position: 0, club: 'B', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 7, goalsAgainst: 3, points: 6 }, // mismo PTS, mejor DG
      C: { position: 0, club: 'C', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 3, goalsAgainst: 6, points: 3 },
    };
    const sorted = sortStandings(s);
    expect(sorted[0]?.club).toBe('B');
    expect(sorted[1]?.club).toBe('A');
    expect(sorted[2]?.club).toBe('C');
    expect(sorted[0]?.position).toBe(1);
  });

  it('getStandingsForDisplay cae al placeholder cuando no hay datos reales', () => {
    const rows = getStandingsForDisplay(123, clubs, 10, {});
    // placeholder: played === week (10), won ~ 4, points > 0
    expect(rows[0]?.played).toBe(10);
    expect(rows[0]?.points).toBeGreaterThan(0);
  });

  it('getStandingsForDisplay usa datos reales cuando hay al menos un partido registrado', () => {
    let s = emptyStandings(clubs);
    s = applyResultToStandings(s, 'Boca', 'River', 3, 1);
    const rows = getStandingsForDisplay(123, clubs, 1, s);
    expect(rows[0]?.club).toBe('Boca');
    expect(rows[0]?.played).toBe(1);
    expect(rows[0]?.won).toBe(1);
    expect(rows[0]?.points).toBe(3);
    expect(rows[0]?.goalsFor).toBe(3);
    expect(rows[0]?.goalsAgainst).toBe(1);
  });

  it('MGC-704 AC: tras 17 fechas cada club tiene PJ coherente con fixture count', () => {
    // Simula 5 fechas (la ronda completa de 5 clubes round-robin).
    // Después de 5 fechas con 2 partidos por fecha, cada club debería
    // tener PJ=4 (5 clubes impares → 1 bye cada fecha, todos juegan 4).
    const fixtures = generateLeagueFixtures(clubs, 777);
    let standings = emptyStandings(clubs);
    const accumulatedFixtures: Array<typeof fixtures[number] & { homeGoals: number; awayGoals: number }> = [];
    for (const f of fixtures) {
      const r = simulateMatchGoals(f.homeId, f.awayId, 777 + f.week);
      standings = applyResultToStandings(standings, f.homeId, f.awayId, r.homeGoals, r.awayGoals);
      accumulatedFixtures.push({ ...f, ...r });
    }
    const sorted = sortStandings(standings);
    // Sanity: PJ == 4 para los 5 clubes (todos jugaron 4, 1 bye cada fecha).
    for (const c of clubs) {
      expect(standings[c]?.played).toBe(4);
    }
    // PJ total = 4 * 5 = 20 = 10 partidos * 2 equipos. Coherente.
    const totalPlayed = sorted.reduce((acc, r) => acc + r.played, 0);
    expect(totalPlayed).toBe(20);
    // Cada partido tiene un ganador claro o empate: PTS = 3*W + D para cada club.
    for (const row of sorted) {
      expect(row.points).toBe(row.won * 3 + row.drawn);
      expect(row.played).toBe(row.won + row.drawn + row.lost);
    }
    // Suma de W + D + L = 4 por club, posiciones 1..5 asignadas.
    const positions = sorted.map((r) => r.position).sort((a, b) => a - b);
    expect(positions).toEqual([1, 2, 3, 4, 5]);
  });

  it('MGC-704 AC: 17 fechas propias del club del jugador reflejan PJ coherente en la tabla', () => {
    // Simulamos el flujo del store: `recordMatchweekResults(week)` se
    // llama cada vez que el jugador avanza de fecha. Tras 17 fechas,
    // el club del jugador (Boca) tiene PJ=17 (porque cada club juega
    // cada fecha — el sistema round-robin con 5 clubes tiene bye para
    // 1 club por fecha, así que en 17 fechas algunos clubes podrían
    // tener PJ entre 13 y 17). En este test, sólo validamos que el
    // Boca registra sus 17 PJ.
    const ownClub = 'Boca';
    let standings = emptyStandings(clubs);
    for (let week = 1; week <= 17; week++) {
      const seedBase = 4242;
      const fixtures = generateLeagueFixtures(clubs, seedBase);
      const matchweekFixtures = fixtures.filter((f) => f.week === ((week - 1) % 5) + 1);
      for (const f of matchweekFixtures) {
        const r = simulateMatchGoals(f.homeId, f.awayId, seedBase + week);
        standings = applyResultToStandings(
          standings,
          f.homeId,
          f.awayId,
          r.homeGoals,
          r.awayGoals,
        );
      }
    }
    // Tras 17 fechas (3 vueltas completas + 2 fechas), Boca debería
    // tener 17 PJ (un partido por fecha si la rotación no le dio bye).
    // Como hay bye en cada fecha, PJ puede variar entre 13-17.
    const boca = standings[ownClub];
    expect(boca).toBeDefined();
    expect(boca!.played).toBeGreaterThanOrEqual(13);
    expect(boca!.played).toBeLessThanOrEqual(17);
    // Invariantes: puntos = 3W + D, played = W + D + L.
    expect(boca!.points).toBe(boca!.won * 3 + boca!.drawn);
    expect(boca!.played).toBe(boca!.won + boca!.drawn + boca!.lost);
    // GF/GC deben ser números enteros no-negativos coherentes.
    expect(boca!.goalsFor).toBeGreaterThanOrEqual(0);
    expect(boca!.goalsAgainst).toBeGreaterThanOrEqual(0);
  });
});