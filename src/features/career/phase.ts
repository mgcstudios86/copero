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