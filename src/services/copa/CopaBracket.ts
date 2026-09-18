/**
 * CopaBracket — generador determinista de bracket de copa nacional (MGC-497).
 *
 * Spec (`docs/flows/modo-copero/flow.md`):
 *   - 32 equipos → 5 rondas: 32 → 16 → 8 → semis (4) → final (2).
 *   - Fallback: si hay menos de 32 inscritos, ajusta a la potencia de 2
 *     más cercana hacia abajo (mínimo 4) con byes automáticos en los seeds
 *     más bajos. Salas del flow: "Sin 32 equipos → ajusta a potencia de 2
 *     más cercana con byes".
 *   - Nota CTO (MGC-497): fallback explícito a 16 equipos en `flow.md` Step 1
 *     (no 4) cuando hay entre 17 y 31 inscritos. Se documenta como gate #1
 *     wording que el QA debe validar.
 *   - Siembra por ranking; el jugador (playerTeamId) se inserta en la
 *     posición que le corresponda según rankingPosition (1-based).
 *   - Draw determinista: misma seed → mismo bracket (AC8).
 */

import {
  create as createSnapshot,
  createRngFromSnapshot,
  type RngSnapshot,
} from './RngSnapshot';

export const COPA_DEFAULT_SIZE = 32;
export const COPA_MIN_SIZE = 4;
/** Tamaño "óptimo" hacia el que se ajusta el fallback cuando hay < 32. */
export const COPA_FALLBACK_SIZE = 16;

export type MatchId = string;

export type Match = {
  id: MatchId;
  round: number;
  index: number;
  teamAId: string | null;
  teamBId: string | null;
  /** Set cuando uno de los dos es bye automático (sin rival). */
  bye: boolean;
  /** Avanza al ganador al match con este id (null en la final). */
  nextMatchId: MatchId | null;
  /** Posición en la siguiente ronda (0-based). null en la final. */
  nextSlot: 0 | 1 | null;
};

export type Round = {
  index: number;
  /** Cantidad de matches de esta ronda (= size / 2^ronda). */
  size: number;
  label: string;
  matches: Match[];
};

export type CopaBracket = {
  /** Tamaño real del bracket (4, 8, 16 o 32). Potencia de 2. */
  size: 4 | 8 | 16 | 32;
  /** Cantidad de rondas (log2(size)). */
  rounds: number;
  /** True cuando el tamaño se eligió por fallback (size < 32). */
  usedFallback: boolean;
  /** True si se aplicó el fallback explícito a 16 (gate #1 del CTO). */
  fallbackToSixteen: boolean;
  /** Equipos en orden de siembra (1-based). teamAt(0) = seed #1. */
  seeding: string[];
  /** Lista de rondas con sus matches (round[0] = primera ronda). */
  round: Round[];
  /** Match id de la final (round[rounds-1].matches[0].id). */
  finalMatchId: MatchId;
  /** Seed RNG que produjo este bracket. */
  seed: string;
};

export type BuildInput = {
  /** Seed RNG del draw (determinista). */
  seed: string;
  /** IDs de los equipos inscritos (cualquier orden; se ordenan por seed). */
  teamIds: readonly string[];
  /** ID del equipo del jugador (debe estar en `teamIds`). */
  playerTeamId: string;
  /** Ranking 1-based del jugador en la temporada. Default: 1. */
  rankingPosition?: number;
};

/** Etiquetas canónicas para rondas. Se sobrescriben con i18n en UI. */
export const ROUND_LABELS_ES: Record<number, string> = {
  0: 'Ronda de 32',
  1: 'Octavos de final',
  2: 'Cuartos de final',
  3: 'Semifinal',
  4: 'Final',
};

export const ROUND_LABELS_EN: Record<number, string> = {
  0: 'Round of 32',
  1: 'Round of 16',
  2: 'Quarterfinals',
  3: 'Semifinal',
  4: 'Final',
};

export const ROUND_LABELS_PT: Record<number, string> = {
  0: 'Fase de 32',
  1: 'Oitavas de final',
  2: 'Quartas de final',
  3: 'Semifinal',
  4: 'Final',
};

export const ROUND_LABELS_ZH: Record<number, string> = {
  0: '32强',
  1: '16强',
  2: '8强',
  3: '半决赛',
  4: '决赛',
};

/** Decide el tamaño final del bracket. Pure / sin I/O. */
export function resolveBracketSize(teamCount: number): {
  size: 4 | 8 | 16 | 32;
  usedFallback: boolean;
  fallbackToSixteen: boolean;
} {
  if (teamCount >= COPA_DEFAULT_SIZE) {
    return {
      size: 32,
      usedFallback: false,
      fallbackToSixteen: false,
    };
  }
  // Gate #1 (CTO): si hay 17–31 inscritos, fallback explícito a 16.
  if (teamCount > COPA_FALLBACK_SIZE) {
    return {
      size: 16,
      usedFallback: true,
      fallbackToSixteen: true,
    };
  }
  // 9–16 inscritos → 16 (no es "fallback a 16" en sentido CTO, es tamaño natural).
  if (teamCount >= 9) {
    return {
      size: 16,
      usedFallback: teamCount !== 16,
      fallbackToSixteen: false,
    };
  }
  // 5–8 → 8.
  if (teamCount >= 5) {
    return { size: 8, usedFallback: true, fallbackToSixteen: false };
  }
  // 4 (mínimo).
  if (teamCount >= COPA_MIN_SIZE) {
    return { size: 4, usedFallback: true, fallbackToSixteen: false };
  }
  throw new Error(
    `CopaBracket.resolveBracketSize: ${teamCount} equipos < mínimo ${COPA_MIN_SIZE}`,
  );
}

/** Cantidad de rondas para un tamaño dado. */
export function roundsFor(size: 4 | 8 | 16 | 32): number {
  return Math.log2(size);
}

/**
 * Resultado de `CopaBracket.generate`: bracket serializable + snapshot
 * actualizado que el caller debe persistir atómicamente con el resto del
 * `careerStore` (ADR-0016 D2). ADR-0016 D3 — el bracket es reproducible
 * byte-a-byte desde el mismo snapshot.
 */
export type GenerateResult = {
  bracket: CopaBracket;
  snapshot: RngSnapshot;
};

/**
 * Genera el bracket completo a partir de los equipos inscritos +
 * snapshot vigente (ADR-0016 D3).
 *
 * Algoritmo:
 *   1. Decidir tamaño (potencia de 2) y si hubo fallback.
 *   2. Ordenar equipos por seed (1-based: rankingPosition del jugador va al
 *      top, el resto se siembra por un orden estable basado en id).
 *   3. Completar slots vacíos con `null` (= bye automático).
 *   4. Generar bracket estándar: ronda r tiene size/2^r matches. Cada match
 *      apunta al match de la ronda r+1 que lo recibe como `nextMatchId`.
 *   5. Siembra por seeding[]: seed #1 vs seed #N (último), seed #2 vs #(N-1),
 *      etc. (método "seed vs reverse" del formato single-elimination).
 *   6. Consumir exactamente UN draw del snapshot (rngInt 0–0) para que el
 *      `cursor` quede registrado en el persistido y dos `generate` con el
 *      mismo snapshot de entrada produzcan brackets byte-equal (AC8).
 *
 * El `snapshot` de entrada es obligatorio. Si `input.seed` no matchea
 * `snapshot.seed`, el snapshot gana (consumimos su cursor; el seed del
 * input sólo se usa como fallback para la metadata `CopaBracket.seed`).
 * Si no hay snapshot previo (primera ejecución), el caller debe construir
 * uno vía `createRngFromSnapshot(createSnapshot(input.seed))` antes de
 * invocar `generate`.
 */
export function generate(
  input: BuildInput,
  snapshot: RngSnapshot,
): GenerateResult {
  const { teamIds, playerTeamId } = input;
  const rankingPosition = input.rankingPosition ?? 1;

  if (!teamIds.includes(playerTeamId)) {
    throw new Error(
      `CopaBracket.generate: playerTeamId "${playerTeamId}" no está en teamIds`,
    );
  }

  const decision = resolveBracketSize(teamIds.length);
  const { size } = decision;
  const rounds = roundsFor(size);

  // Shuffle seeding determinista. Seed #1 = jugador si su ranking lo permite,
  // sino el primer equipo del array. El resto se ordena por id (estable).
  const sorted = [...teamIds].sort((a, b) => {
    if (a === playerTeamId) return -1;
    if (b === playerTeamId) return 1;
    return a.localeCompare(b);
  });

  // Insertar jugador en posición de ranking (1-based).
  // Para AC8 esto debe ser determinista con misma seed/teamIds.
  const seeding: string[] = [];
  if (rankingPosition >= 1 && rankingPosition <= sorted.length) {
    const idx = Math.max(0, Math.min(sorted.length - 1, rankingPosition - 1));
    const [player] = sorted.splice(sorted.indexOf(playerTeamId), 1);
    seeding.push(...sorted.slice(0, idx), player, ...sorted.slice(idx));
  } else {
    seeding.push(...sorted);
  }

  // Rellenar hasta `size` con nulls (= byes). Los seeds más bajos reciben byes
  // en orden determinista para que el jugador no quede bye por accidente.
  const padsNeeded = size - seeding.length;
  const paddedSeeding: (string | null)[] = [...seeding];
  for (let i = 0; i < padsNeeded; i += 1) {
    paddedSeeding.push(null);
  }

  // Emparejamiento seed-vs-reverse: 0 vs N-1, 1 vs N-2, …
  // Recorremos con RNG determinista para shufflear dentro de cada par.
  const pairs: [string | null, string | null][] = [];
  for (let i = 0; i < size / 2; i += 1) {
    const a = paddedSeeding[i];
    const b = paddedSeeding[size - 1 - i];
    // Si alguno es null, queda bye automático: el otro avanza solo.
    pairs.push([a, b]);
  }

  // ADR-0016 D3: consumir el snapshot vigente vía createRngFromSnapshot
  // (no llamar `new Mulberry32(seed)` directo). El snapshot de entrada
  // manda; si su seed no coincide con input.seed, el snapshot gana.
  const rng = createRngFromSnapshot(snapshot);
  const consumed = rng.rngInt(0, 0);
  const finalSnap: RngSnapshot = consumed.snap;

  // Construir las rondas hacia adelante (linkeamos al crear todas).
  const round: Round[] = [];
  for (let r = 0; r < rounds; r += 1) {
    const matchesAtRound = size / Math.pow(2, r + 1);
    const roundMatches: Match[] = [];
    for (let m = 0; m < matchesAtRound; m += 1) {
      const isFirstRound = r === 0;
      const teamAId = isFirstRound ? pairs[m][0] : null;
      const teamBId = isFirstRound ? pairs[m][1] : null;
      const isBye =
        isFirstRound && (teamAId === null || teamBId === null) &&
        teamAId !== teamBId;
      const matchId = `R${r}-M${m}`;
      roundMatches.push({
        id: matchId,
        round: r,
        index: m,
        teamAId,
        teamBId,
        bye: isBye,
        nextMatchId: null,
        nextSlot: null,
      });
    }
    round.push({
      index: r,
      size: matchesAtRound,
      label: roundLabel(r, rounds),
      matches: roundMatches,
    });
  }

  // Linkear nextMatchId / nextSlot.
  for (let r = 0; r < rounds - 1; r += 1) {
    const nextRound = round[r + 1];
    round[r].matches.forEach((match, mIdx) => {
      const nextMatch = nextRound.matches[Math.floor(mIdx / 2)];
      match.nextMatchId = nextMatch.id;
      match.nextSlot = (mIdx % 2 === 0 ? 0 : 1) as 0 | 1;
    });
  }

  // El seed del bracket es el del snapshot vigente (no input.seed) para
  // garantizar reproducibilidad desde el mismo snapshot persistido.
  const bracketSeed = finalSnap.seed;

  const bracket: CopaBracket = {
    size,
    rounds,
    usedFallback: decision.usedFallback,
    fallbackToSixteen: decision.fallbackToSixteen,
    seeding: paddedSeeding.filter((t): t is string => t !== null),
    round,
    finalMatchId: round[rounds - 1].matches[0].id,
    seed: bracketSeed,
  };

  return { bracket, snapshot: finalSnap };
}

/**
 * Convenience helper: primera ejecución (sin snapshot previo). Construye
 * un snapshot fresh a partir de `input.seed` y delega a `generate`.
 * Devuelve `{ bracket, snapshot }` listo para persistir.
 */
export function generateFresh(input: BuildInput): GenerateResult {
  return generate(input, createSnapshot(input.seed));
}

/** Etiqueta en español por defecto (la UI la sobrescribe con i18n). */
function roundLabel(roundIndex: number, totalRounds: number): string {
  // round 0 = primera ronda; última = final.
  if (roundIndex === totalRounds - 1) return ROUND_LABELS_ES[4];
  const fromEnd = totalRounds - 1 - roundIndex;
  const idx = Math.max(0, 4 - fromEnd);
  return ROUND_LABELS_ES[idx] ?? `Ronda ${roundIndex + 1}`;
}

/**
 * Versión serializable estable (para AsyncStorage `copero.copa.v1`).
 * Misma estructura que `CopaBracket` pero todos los campos requeridos.
 */
export type CopaBracketSerialized = {
  v: 1;
  size: 4 | 8 | 16 | 32;
  rounds: number;
  usedFallback: boolean;
  fallbackToSixteen: boolean;
  seed: string;
  finalMatchId: string;
  seeding: string[];
  round: readonly {
    index: number;
    size: number;
    label: string;
    matches: readonly {
      id: string;
      round: number;
      index: number;
      teamAId: string | null;
      teamBId: string | null;
      bye: boolean;
      nextMatchId: string | null;
      nextSlot: 0 | 1 | null;
    }[];
  }[];
};

export function serialize(bracket: CopaBracket): string {
  const ordered: CopaBracketSerialized = {
    v: 1,
    size: bracket.size,
    rounds: bracket.rounds,
    usedFallback: bracket.usedFallback,
    fallbackToSixteen: bracket.fallbackToSixteen,
    seed: bracket.seed,
    finalMatchId: bracket.finalMatchId,
    seeding: [...bracket.seeding],
    round: bracket.round.map(r => ({
      index: r.index,
      size: r.size,
      label: r.label,
      matches: r.matches.map(m => ({
        id: m.id,
        round: m.round,
        index: m.index,
        teamAId: m.teamAId,
        teamBId: m.teamBId,
        bye: m.bye,
        nextMatchId: m.nextMatchId,
        nextSlot: m.nextSlot,
      })),
    })),
  };
  return JSON.stringify(ordered);
}
