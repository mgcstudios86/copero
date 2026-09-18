/**
 * MGC-487 — Temporada loop 5+ semanas + playoffs + fin de año.
 *
 * Generador puro del bracket de playoffs nacionales (semanas 35–38)
 * para cerrar la fase regular de `phase.ts`. Determinista vía RNG para
 * que QA valide brackets estables entre cargas (acceptance bar #7 de
 * strategies.md).
 *
 * Reglas:
 *  - 8 equipos seeded por posición final en la tabla (1..8).
 *  - Sembrado #1 vs #8, #2 vs #7, ..., #4 vs #5 (estándar single-elim).
 *  - Cuatro rondas: cuartos (semana 35) → semis (36) → final (37/38).
 *  - Empate en playoff → tanda de penales determinista
 *    (`rng.penalties` placeholder; la implementación real vive en
 *    `match.ts#resolveMatch`).
 *  - Si hay menos de 8 equipos, los 4 mejores juegan semis+final;
 *    el resto tiene bye automático.
 */

import { SEASON_LENGTH } from './phase';

export type PlayoffRound = 'quarter' | 'semi' | 'final';

export type PlayoffMatch = {
  round: PlayoffRound;
  /** Semana del calendario en que se juega (35..38). */
  week: number;
  /** Slot 0-based dentro de la ronda (0..1 para cuartos, 0 para semis/final). */
  slot: number;
  home: string;
  away: string;
  /** `null` mientras la ronda previa no se resolvió. */
  winner: string | null;
};

export type PlayoffBracket = {
  matches: PlayoffMatch[];
  champion: string | null;
};

/** Tamaño del bracket por defecto. */
export const PLAYOFF_TEAMS = 8;

/** Semana del calendario en que arranca playoffs (MGC-487 Step 4). */
export const PLAYOFF_START_WEEK = 35;

/** Tipo mínimo del RNG que consume el bracket generator. */
export type BracketRng = {
  int: (min: number, max: number) => number;
};

/**
 * Construye el bracket inicial de cuartos a partir de los 8 equipos
 * sembrados (seeded[0] = campeón fase regular). Devuelve sólo los
 * 4 partidos de cuartos; semis y final se completan vía
 * `advancePlayoffRound`.
 *
 * Bye automático: si `seeded.length < 8`, los 4 mejores pasan directo
 * a semis (`advancePlayoffRound` ya los siembra).
 */
export function buildPlayoffBracket(
  seeded: string[],
  rng: BracketRng,
): PlayoffMatch[] {
  if (seeded.length < 4) {
    throw new Error(
      `buildPlayoffBracket: requiere ≥4 equipos (recibidos ${seeded.length}).`,
    );
  }

  // Sembrado estándar: 1 vs 8, 2 vs 7, 3 vs 6, 4 vs 5.
  // Si la tabla tiene menos de 8, los faltantes son placeholder
  // `BYE-<n>` para no romper el shape del bracket. En `advancePlayoffRound`
  // los BYE avanzan automático.
  const padded = [...seeded];
  while (padded.length < PLAYOFF_TEAMS) {
    padded.push(`BYE-${padded.length + 1}`);
  }

  const pairings: Array<[number, number]> = [
    [0, 7],
    [1, 6],
    [2, 5],
    [3, 4],
  ];

  return pairings.map(([a, b], slot) => {
    const home = padded[a];
    const away = padded[b];
    return {
      round: 'quarter',
      week: PLAYOFF_START_WEEK + slot, // 35..38 si cupiera en una sola semana; acá cada slot es una semana distinta
      slot,
      home,
      away,
      // El ganador se resuelve al avanzar la ronda. Si alguno es BYE,
      // gana el sembrado más alto sin pasar por el RNG.
      winner: home.startsWith('BYE-')
        ? away
        : away.startsWith('BYE-')
          ? home
          : null,
    };
  });
}

/**
 * Resuelve un partido pendiente del bracket. Devuelve el nombre del
 * ganador. Si `match.winner` ya está seteado (BYE), lo devuelve sin
 * consumir RNG.
 */
export function resolvePlayoffMatch(
  match: PlayoffMatch,
  rng: BracketRng,
): string {
  if (match.winner !== null) return match.winner;
  // 50/50 determinista; el motor real (match.ts) pondera por OVR.
  return rng.int(0, 1) === 0 ? match.home : match.away;
}

/**
 * Avanza el bracket una ronda (cuartos → semis → final). Devuelve la
 * lista actualizada de partidos (incluye las nuevas semis/final con
 * `winner: null` salvo que algún BYE haya pasado).
 */
export function advancePlayoffRound(
  matches: PlayoffMatch[],
  rng: BracketRng,
): PlayoffMatch[] {
  const resolved = matches.map((m) => ({ ...m, winner: resolvePlayoffMatch(m, rng) }));

  const byRound: Record<PlayoffRound, PlayoffMatch[]> = {
    quarter: resolved.filter((m) => m.round === 'quarter'),
    semi: resolved.filter((m) => m.round === 'semi'),
    final: resolved.filter((m) => m.round === 'final'),
  };

  if (byRound.quarter.length === 4 && byRound.semi.length === 0) {
    const semis: PlayoffMatch[] = [
      {
        round: 'semi',
        week: PLAYOFF_START_WEEK + 1,
        slot: 0,
        home: byRound.quarter[0].winner!,
        away: byRound.quarter[1].winner!,
        winner: null,
      },
      {
        round: 'semi',
        week: PLAYOFF_START_WEEK + 2,
        slot: 1,
        home: byRound.quarter[2].winner!,
        away: byRound.quarter[3].winner!,
        winner: null,
      },
    ];
    return [...resolved, ...semis];
  }

  if (byRound.semi.length === 2 && byRound.final.length === 0) {
    const finalMatch: PlayoffMatch = {
      round: 'final',
      week: SEASON_LENGTH,
      slot: 0,
      home: byRound.semi[0].winner!,
      away: byRound.semi[1].winner!,
      winner: null,
    };
    return [...resolved, finalMatch];
  }

  // Final resuelta o no hay más rondas que avanzar.
  return resolved;
}

/** Determina el campeón del bracket. `null` mientras la final siga pendiente. */
export function bracketChampion(matches: PlayoffMatch[]): string | null {
  const finalMatch = matches.find((m) => m.round === 'final');
  if (!finalMatch) return null;
  return finalMatch.winner;
}
