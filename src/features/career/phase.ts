/**
 * MGC-212 — Loop de temporada + calendario semanal jugable.
 *
 * Modelo puro de fase de temporada. Una temporada arranca en pretemporada
 * (semana 0), entra en fase regular (semanas 1–34), puede terminar en
 * playoff / relegación (semanas 35–38) según el puesto en la tabla, y
 * al cerrar la semana 38 transiciona a fase `fin` (listo para rollover a
 * la próxima temporada vía `advanceSeason`).
 *
 * Reglas:
 *  - 38 fechas en fase regular.
 *  - Semana 0 = pretemporada (amistosos, sin efecto en standings).
 *  - Semana 35–38 = playoff / relegación según standings (placeholder
 *    en MGC-212: siempre es `playoff` para top 4 y `relegacion` para
 *    últimos 4; el resto sigue en `regular` mientras disputa la fecha).
 *  - Semana 38 cerrada → `fin` (gate de UI para habilitar
 *    `advanceSeason`).
 *
 * Acceptance criteria §2 MGC-212: "Avanzar 38 semanas llega a fin de
 * temporada (sin errores)".
 */

export type SeasonPhase =
  | 'pretemporada'
  | 'regular'
  | 'playoff'
  | 'relegacion'
  | 'fin';

/** Total de fechas en fase regular (MGC-212 §2 AC). */
export const SEASON_LENGTH = 38;

/** Semana de pretemporada (0-indexed, antes de la fecha 1). */
export const PRETEMPORADA_WEEK = 0;

/**
 * Determina la fase actual de la temporada en función de la semana
 * (1-indexed, igual que `profile.week`) y la posición del club en la
 * tabla al cierre de la fecha regular.
 *
 * @param week semana del calendario (1..38)
 * @param position posición final del club (1 = campeón). Cuando es
 * `null` se asume `regular` (no se computaron standings).
 */
export function phaseFromWeek(
  week: number,
  position: number | null = null,
): SeasonPhase {
  if (week <= PRETEMPORADA_WEEK) return 'pretemporada';
  if (week >= SEASON_LENGTH) return 'fin';
  if (week <= 34) return 'regular';
  // Week 35–38: playoff (top 4) o relegación (bottom 4).
  if (position !== null) {
    if (position <= 4) return 'playoff';
    if (position >= 17) return 'relegacion';
  }
  return 'regular';
}

/** Texto canónico para UI / i18n. */
export const PHASE_LABELS: Record<SeasonPhase, string> = {
  pretemporada: 'pretemporada',
  regular: 'regular',
  playoff: 'playoff',
  relegacion: 'relegacion',
  fin: 'fin',
};

export type MatchdayRow = {
  index: number; // 1..38
  week: number; // alias de index (semana del calendario)
  opponent: string; // nombre del club rival (placeholder si no hay draw)
  isHome: boolean;
  result: 'pendiente' | 'won' | 'lost' | 'draw';
};

/**
 * Genera las 38 filas del calendario usando un RNG determinista.
 * Acepta el seed del snapshot para que QA valide calendario estable
 * entre cargas (acceptance bar #7 de strategies.md).
 */
export function buildCalendar(
  seed: number,
  opponents: string[],
  rng: { int: (min: number, max: number) => number },
): MatchdayRow[] {
  const rows: MatchdayRow[] = [];
  for (let i = 1; i <= SEASON_LENGTH; i++) {
    const opponentIdx = rng.int(0, Math.max(0, opponents.length - 1));
    rows.push({
      index: i,
      week: i,
      opponent: opponents[opponentIdx] ?? `Rival ${i}`,
      isHome: rng.int(0, 1) === 1,
      result: 'pendiente',
    });
  }
  return rows;
}

/** Tipos auxiliares para standings (MGC-212 AC §3). */
export type StandingRow = {
  position: number;
  club: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

/**
 * Posición del club del jugador en la tabla al cierre de la semana
 * `week`. Modelo placeholder: distribución determinista según seed +
 * week. El cálculo real del motor vive en `simulation.ts` (matchweek
 * resolveMatch). Aquí sólo se computa la posición que se muestra en
 * `CalendarScreen` cuando aún no se jugó la fecha.
 */
export function placeholderPosition(
  seed: number,
  week: number,
  totalClubs: number,
): number {
  // Hash determinista (seed * 1009 + week) % totalClubs + 1.
  const raw = (seed * 1009 + week * 31) % Math.max(1, totalClubs);
  return raw + 1;
}

/** Construye una tabla de posiciones placeholder para mostrar en UI. */
export function buildStandings(
  seed: number,
  clubs: string[],
  week: number,
): StandingRow[] {
  const total = clubs.length;
  const rows: StandingRow[] = clubs.map((club, idx) => {
    const position = placeholderPosition(seed + idx * 7, week, total);
    return {
      position,
      club,
      played: week,
      won: Math.max(0, Math.floor(week * 0.45)),
      drawn: Math.max(0, Math.floor(week * 0.2)),
      lost: Math.max(0, week - Math.floor(week * 0.45) - Math.floor(week * 0.2)),
      goalsFor: Math.max(0, Math.floor(week * 1.4)),
      goalsAgainst: Math.max(0, Math.floor(week * 1.1)),
      points: 0,
    };
  });
  rows.forEach((row) => {
    row.points = row.won * 3 + row.drawn;
  });
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    return gdB - gdA;
  });
  return rows.map((row, idx) => ({ ...row, position: idx + 1 }));
}

/**
 * MGC-704 — modelo de liga persistible. Cada club del array `clubs`
 * recibe una `StandingRow` vacía al iniciar la temporada (PJ=0, W/D/L=0,
 * GF/GC=0, PTS=0). La posición se asigna al ordenar en `sortStandings`.
 */
export function emptyStandings(clubs: string[]): Record<string, StandingRow> {
  const out: Record<string, StandingRow> = {};
  for (const club of clubs) {
    out[club] = {
      position: 0,
      club,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    };
  }
  return out;
}

/**
 * MGC-704 — genera los fixtures round-robin de la temporada. Algoritmo
 * estándar "circle method" extendido para N impar con un dummy BYE:
 *
 *  - Con N clubes, total de fechas = N (si N es impar) o N-1 (si N es par).
 *  - Con N=5 (impar, nuestro caso): 5 fechas × 2 partidos = 10 partidos
 *    únicos. Cada club tiene 4 PJ y 1 bye.
 *  - El seed determina el ordenamiento inicial del círculo. Mismo seed
 *    + mismos clubes → mismo fixture set (AC: tests deterministas).
 *  - Los partidos van `week` 1-indexed.
 *
 * Por qué un dummy BYE en vez de N-1 rounds con slots=N: el estándar
 * garantiza que cada par único de clubes se cruce exactamente una vez.
 * Implementaciones ad-hoc (rotación parcial sin BYE) suelen repetir
 * partidos y dejar pares sin cruzar.
 */
export function generateLeagueFixtures(
  clubs: string[],
  seed: number,
): Array<{ week: number; homeId: string; awayId: string }> {
  if (clubs.length < 2) return [];
  const n = clubs.length;
  const BYE = '__BYE__';
  // Trabajamos con N+1 slots si N es impar (un BYE) o N si es par.
  const slots = n % 2 === 1 ? n + 1 : n;
  const order = n % 2 === 1 ? [...clubs, BYE] : [...clubs];
  // Shuffle determinista del orden inicial (excepto el primer club,
  // que actúa de "ancla" del círculo). Fisher-Yates con mulberry32-like.
  let s = (seed >>> 0) || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let i = order.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(rand() * (i));
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  const fixtures: Array<{ week: number; homeId: string; awayId: string }> = [];
  const rounds = slots - 1;
  for (let r = 0; r < rounds; r++) {
    const week = r + 1;
    for (let i = 0; i < slots / 2; i++) {
      const home = order[i]!;
      const away = order[slots - 1 - i]!;
      if (home === BYE || away === BYE) continue;
      fixtures.push({ week, homeId: home, awayId: away });
    }
    // Rotación: mantener el primer club fijo, rotar el resto una posición.
    const tail = order.pop()!;
    order.splice(1, 0, tail);
  }
  return fixtures;
}

/**
 * MGC-704 — simula un partido. Resultado determinista por seed+home+away
 * con distribución plausible (0-4 goles por equipo). El club local tiene
 * leve ventaja (factor 1.1 en goles esperados).
 */
export function simulateMatchGoals(
  homeId: string,
  awayId: string,
  seed: number,
): { homeGoals: number; awayGoals: number } {
  let s = (seed >>> 0) ^ hashStr(homeId) ^ (hashStr(awayId) * 31);
  s = s || 1;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const homeXg = 1.1 + next() * 1.2;
  const awayXg = 1.0 + next() * 1.1;
  const sample = (xg: number) => {
    // Poisson-ish discreto vía suma de uniforms truncada a [0, 4].
    let g = 0;
    let remaining = xg;
    for (let k = 0; k < 4; k++) {
      if (remaining <= 0) break;
      const u = next();
      if (u < remaining) {
        g++;
        remaining -= 1;
      } else {
        break;
      }
    }
    return Math.min(4, g);
  };
  return { homeGoals: sample(homeXg), awayGoals: sample(awayXg) };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/**
 * MGC-704 — aplica un resultado al slice `seasonStandings`. Devuelve un
 * nuevo objeto (inmutable) con PJ/W/D/L/GF/GC/PTS actualizados para los
 * dos equipos involucrados. Equipos no presentes en el slice quedan
 * inicializados vía `emptyStandings` antes de aplicar.
 */
export function applyResultToStandings(
  standings: Record<string, StandingRow>,
  homeId: string,
  awayId: string,
  homeGoals: number,
  awayGoals: number,
): Record<string, StandingRow> {
  const next: Record<string, StandingRow> = { ...standings };
  if (!next[homeId]) {
    next[homeId] = {
      position: 0,
      club: homeId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    };
  }
  if (!next[awayId]) {
    next[awayId] = {
      position: 0,
      club: awayId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    };
  }
  const home = { ...next[homeId]! };
  const away = { ...next[awayId]! };
  home.played += 1;
  away.played += 1;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;
  if (homeGoals > awayGoals) {
    home.won += 1;
    home.points += 3;
    away.lost += 1;
  } else if (homeGoals < awayGoals) {
    away.won += 1;
    away.points += 3;
    home.lost += 1;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }
  next[homeId] = home;
  next[awayId] = away;
  return next;
}

/**
 * MGC-704 — ordena un slice de standings por PTS > DG > GF. Devuelve el
 * array ordenado con `position` reasignado. NO muta el objeto.
 */
export function sortStandings(
  standings: Record<string, StandingRow>,
): StandingRow[] {
  const rows = Object.values(standings);
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.club.localeCompare(b.club);
  });
  return rows.map((row, idx) => ({ ...row, position: idx + 1 }));
}

/**
 * MGC-704 — helper de display. Si el caller provee `seasonStandings`
 * populated (al menos un club con `played > 0`), se usa el slice real
 * ordenado. Si está vacío o ausente (carrera recién creada, save legacy
 * pre-MGC-704), cae al placeholder determinista `buildStandings` para
 * que la UI no muestre "sin datos" durante la pretemporada.
 */
export function getStandingsForDisplay(
  seed: number,
  clubs: string[],
  week: number,
  seasonStandings?: Record<string, StandingRow>,
): StandingRow[] {
  const hasRealData =
    !!seasonStandings &&
    Object.values(seasonStandings).some((r) => r.played > 0);
  if (!hasRealData) {
    return buildStandings(seed, clubs, week);
  }
  // Si hay datos reales pero faltan clubes (caso edge: club que se
  // retiró), los inicializamos con fila en cero para que la tabla los
  // muestre igual.
  const filled: Record<string, StandingRow> = { ...seasonStandings! };
  for (const c of clubs) {
    if (!filled[c]) {
      filled[c] = {
        position: 0,
        club: c,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      };
    }
  }
  return sortStandings(filled);
}