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
 *  - **MGC-487.2**: la resolución del partido se integra con
 *    `match.ts#resolveMatch` (OVR-weighted). El placeholder 50/50
 *    (`rng.int(0, 1)`) queda como fallback defensivo para clubes no
 *    catalogados. Empate exacto → home-advantage determinista.
 *  - Si hay menos de 8 equipos, los 4 mejores juegan semis+final;
 *    el resto tiene bye automático.
 */

import { SEASON_LENGTH } from './phase';
import { resolveMatch } from './match';
import { ACADEMY_CLUBS } from './clubs';
import type { Rng } from './rng';
import type { PositionStats } from './position-stats';
import type { Club, PlayerProfile } from '@/types/career';

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
 * MGC-487.2 — Adapter `BracketRng → Rng`. `BracketRng` sólo expone
 * `int(min, max)`; `match.ts#resolveMatch` requiere la superficie
 * completa (`next`, `int`, `chance`, `snapshot`, `restore`). Esta
 * adapter deriva `next` y `chance` desde `int` para mantener el
 * contrato público del bracket inalterado (la UI sigue pasando un
 * Mulberry32 minimal sin snapshot/restore).
 */
function asFullRng(b: BracketRng): Rng {
  return {
    next: () => b.int(0, 999_999) / 1_000_000,
    int: (min, max) => b.int(min, max),
    chance: (p) => b.int(0, 999_999) / 1_000_000 < p,
    snapshot: () => ({ v: 1, seed: 0, cursor: 0, algorithm: 'mulberry32' }),
    restore: () => {
      // No-op: la adapter no persiste estado.
    },
  };
}

/**
 * MGC-487.2 — Look up a club catalog entry by display name.
 * Devuelve `null` para placeholders BYE o clubes no catalogados
 * (la resolución cae al fallback defensivo).
 */
function findClub(name: string): Club | null {
  if (name.startsWith('BYE-')) return null;
  return ACADEMY_CLUBS.find((c) => c.name === name) ?? null;
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

/**
 * MGC-487.2 — Construye un `PlayerProfile` sintético (capitán/figura)
 * para que `match.ts#resolveMatch` pueda consumir la reputación del club.
 * El `positionStats` se mapea uniforme al `ovr` (= reputation × 20)
 * para que `weightedForPosition` (en match.ts) devuelva el OVR del club
 * y la diferencia entre clubes sea la dominante. Sin esto, la
 * componente de luck (±25) enmascararía por completo la diferencia
 * de reputación (±5), devolviendo un bracket prácticamente 50/50 — el
 * bug que estamos arreglando.
 *
 * Sin stats per-jugador por club (no persistidas); el capitán es la
 * abstracción suficiente para ponderar el bracket.
 */
function buildSyntheticProfile(club: Club): PlayerProfile {
  const reputation = club.reputation ?? 3;
  const ovr = clamp(reputation * 20, 20, 99); // 1..5 → 20..100
  const positionStats: PositionStats = {
    reflejos: ovr,
    posicionamiento: ovr,
    salida: ovr,
    manos: ovr,
    marcaje: ovr,
    cabeceo: ovr,
    anticipacion: ovr,
    vision: ovr,
    pase: ovr,
    dribling: ovr,
    resistencia: ovr,
    definicion: ovr,
    velocidad: ovr,
    regate: ovr,
    juegoAereo: ovr,
  };
  return {
    name: `${club.name} (capitán)`,
    number: 1,
    position: 'CM', // mediocampista neutral: position factor parejo.
    nationalityCode: 'AR',
    leagueCode: '',
    preferredFoot: 'right',
    age: 28,
    club,
    value: 0,
    ovr,
    stats: { apps: 0, goals: 0, ast: 0 },
    attrs: { tecnico: ovr, fisico: ovr, mental: ovr, portero: ovr },
    career: {
      presupuesto: 0,
      moral: 50,
      fisico: 50,
      confianza: 50,
      racha: 0,
      lesion: {
        kind: 'ninguna',
        fechasOut: 0,
        startedAtWeek: 0,
        affectedAttr: 'fisico',
      },
      reputation: {
        prensa: 'neutral',
        hinchada: 'aceptado',
        vestuario: 'integrado',
        seleccionConvocado: false,
      },
    },
    positionStats,
    week: 0,
    season: 0,
    clubPresupuesto: 0,
    clubInteres: false,
  };
}

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
  // El bracket inicial no consume RNG: los BYE avanzan directo y los
  // partidos se resolverán al llamar `resolvePlayoffMatch` desde
  // `advancePlayoffRound`. El parámetro queda en la firma para mantener
  // simetría con las funciones que sí lo usan (API pública estable).
  _rng: BracketRng,
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

  const pairings: [number, number][] = [
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
 *
 * MGC-487.2 — Integración con `match.ts#resolveMatch`:
 * - Por cada club, construye un `PlayerProfile` sintético (capitán)
 *   cuya OVR = club.reputation × 20 y corre `resolveMatch` con el
 *   `positionStats` poblado al OVR y el RNG adaptado a la superficie
 *   completa de `Rng` (vía `asFullRng`).
 * - Gana quien tenga el `score` mayor.
 * - Empate exacto → home-advantage determinista (draw del RNG).
 * - Club desconocido (no catalogado) → home-advantage puro sin invocar
 *   `resolveMatch` (defensivo: el bracket puede recibir nombres libres
 *   en tests con strings arbitrarios).
 *
 * El resultado sigue siendo determinista: con la misma semilla y los
 * mismos clubes, el ganador del bracket es idéntico entre cargas.
 */
export function resolvePlayoffMatch(
  match: PlayoffMatch,
  rng: BracketRng,
): string {
  if (match.winner !== null) return match.winner;

  const homeClub = findClub(match.home);
  const awayClub = findClub(match.away);

  // Fallback defensivo: si algún club no está en el catálogo (ej. en
  // tests con strings arbitrarios como 'A'/'B'/'C'), home-advantage
  // puro. Mantiene el comportamiento histórico del placeholder 50/50.
  if (!homeClub || !awayClub) {
    return rng.int(0, 1) === 0 ? match.home : match.away;
  }

  const rngFull = asFullRng(rng);
  const homeProfile = buildSyntheticProfile(homeClub);
  const awayProfile = buildSyntheticProfile(awayClub);
  const homeOutcome = resolveMatch(
    homeProfile,
    homeProfile.positionStats!,
    rngFull,
  );
  const awayOutcome = resolveMatch(
    awayProfile,
    awayProfile.positionStats!,
    rngFull,
  );

  if (homeOutcome.score > awayOutcome.score) return match.home;
  if (awayOutcome.score > homeOutcome.score) return match.away;

  // Empate técnico → home-advantage determinista.
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
