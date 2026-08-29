/**
 * Draft de leyendas — 8 rondas (MGC-208 §1).
 *
 * Pure functions, sin React ni timers. El draft es una mini-FSM que
 * produce una `PlayerCard` final (attrs + skills + OVR inicial + potencial).
 *
 * Reglas:
 * - 8 rondas, una por slot del tablero (PAC/SHO/PAS/DRI/DEF/PHY/SKL/WF).
 * - Cada ronda muestra una leyenda (orden determinista, índice inicial 0).
 * - El jugador puede "cambiar leyenda" hasta `MAX_SWAPS` veces antes de
 *   confirmar (mismo contador que la maqueta Vite+React: 5 swaps).
 * - Confirmar una leyenda asigna su `best` al slot actual.
 * - Cuando se llenan los 8 slots, se calcula OVR inicial + potencial.
 */

import type { AttrKey, DraftBoard, DraftPick, PlayerCard, SkillKey } from '@/types/career';
import { DRAFT_ROUNDS, DRAFT_SLOTS, LEGENDS, legendAt } from './legends';

/** Swaps disponibles al iniciar el draft (MGC-208). */
export const MAX_SWAPS = 5;

/** Estado inicial del draft. */
export const initialDraftBoard = (): DraftBoard => ({
  round: 1,
  legendIdx: 0,
  swapsLeft: MAX_SWAPS,
  picks: [],
});

/** Devuelve `true` cuando todos los slots están llenos. */
export function isDraftComplete(board: DraftBoard): boolean {
  return board.picks.length >= DRAFT_ROUNDS;
}

/** Avanza a la siguiente leyenda. No-op si ya no quedan swaps. */
export function swapLegend(board: DraftBoard): DraftBoard {
  if (board.swapsLeft <= 0) return board;
  return {
    ...board,
    legendIdx: (board.legendIdx + 1) % LEGENDS.length,
    swapsLeft: board.swapsLeft - 1,
  };
}

/**
 * Confirma el `best` de la leyenda actual en el slot de la ronda.
 * Si todos los slots quedan llenos, devuelve el board completo y la
 * `PlayerCard` resultante. El caller decide si avanza de stage.
 */
export function pickCurrentLegend(board: DraftBoard): {
  board: DraftBoard;
  card: PlayerCard | null;
} {
  if (board.picks.length >= DRAFT_ROUNDS) return { board, card: null };

  const legend = legendAt(board);
  const slot = DRAFT_SLOTS[board.picks.length];
  const pick: DraftPick = {
    slot,
    legendId: legend.id,
    legendName: legend.name,
    value: legend.best.value,
  };

  const next: DraftBoard = {
    ...board,
    picks: [...board.picks, pick],
    legendIdx: (board.legendIdx + 1) % LEGENDS.length,
    round: board.picks.length + 2, // próxima ronda (1-indexed)
  };

  if (next.picks.length < DRAFT_ROUNDS) {
    return { board: next, card: null };
  }
  return { board: next, card: cardFromPicks(next.picks) };
}

/** Helper: arma la PlayerCard a partir de los 8 picks. */
export function cardFromPicks(picks: DraftPick[]): PlayerCard {
  const attrs = {
    PAC: 50,
    SHO: 50,
    PAS: 50,
    DRI: 50,
    DEF: 50,
    PHY: 50,
  } as Record<AttrKey, number>;
  const skills = { SKL: 1, WF: 1 } as Record<SkillKey, number>;

  for (const pick of picks) {
    if (pick.slot === 'SKL' || pick.slot === 'WF') {
      // Skill stars capped a 5.
      skills[pick.slot] = Math.max(skills[pick.slot], Math.min(5, pick.value));
    } else {
      // Atributo: el pick aporta el valor crudo de la leyenda.
      attrs[pick.slot] = Math.max(20, Math.min(99, pick.value));
    }
  }

  const ovrInicial = computeOvrInicial(attrs);
  const potencial = computePotencial(attrs, skills);

  return { attrs, skills, ovrInicial, potencial };
}

/**
 * OVR inicial: promedio ponderado de los 6 atributos (mismo peso que
 * `reputation.ts#recomputeOvrForPosition`). Se redondea a entero y se
 * clampea a [40, 85] (un rookie recién drafteado).
 */
export function computeOvrInicial(attrs: Record<AttrKey, number>): number {
  const avg = Math.round(
    (attrs.PAC * 0.15 +
      attrs.SHO * 0.2 +
      attrs.PAS * 0.15 +
      attrs.DRI * 0.2 +
      attrs.DEF * 0.1 +
      attrs.PHY * 0.2) /
      1,
  );
  return Math.max(40, Math.min(85, avg));
}

/**
 * Potencial: OVR inicial + bonus por skills y por best atributos altos.
 * El potencial es el techo al que la carrera puede llegar (MGC-208 §1).
 * La fórmula premia legends con best ≥ 95 y skills 5★.
 */
export function computePotencial(
  attrs: Record<AttrKey, number>,
  skills: Record<SkillKey, number>,
): number {
  const avgAttrs = Math.round(
    (attrs.PAC + attrs.SHO + attrs.PAS + attrs.DRI + attrs.DEF + attrs.PHY) / 6,
  );
  const skillBonus = (skills.SKL + skills.WF) * 2; // 0..20
  // Bonus por best altos: contar cuántos attrs ≥ 90.
  const topBonus = (Object.values(attrs) as number[]).filter((v) => v >= 90).length * 2; // 0..12
  const potencial = avgAttrs + skillBonus + topBonus;
  return Math.max(60, Math.min(99, potencial));
}

/**
 * Atributos finales del jugador: punto de partida de la carrera.
 * Combina los 4 atributos del profile pre-draft (`tecnico`/`fisico`/
 * `mental`/`portero`) con la carta del draft, manteniendo la coherencia
 * con el resto del motor (`reputation.ts#recomputeOvrForPosition`).
 *
 * Mapeo (determinista, documentado en PR):
 * - tecnico ← (PAS + DRI) / 2
 * - fisico  ← (PAC + PHY) / 2
 * - mental  ← (SHO * 0.5 + DEF) (tiro + defensa mentalizan el match)
 * - portero ← (DEF * 0.5 + 25) (peso bajo; GK tiene recomputeOvrForPosition aparte)
 */
export function attrsFromCard(card: PlayerCard): {
  tecnico: number;
  fisico: number;
  mental: number;
  portero: number;
} {
  const round = (n: number) => Math.max(0, Math.min(99, Math.round(n)));
  return {
    tecnico: round((card.attrs.PAS + card.attrs.DRI) / 2),
    fisico: round((card.attrs.PAC + card.attrs.PHY) / 2),
    mental: round(card.attrs.SHO * 0.5 + card.attrs.DEF * 0.5),
    portero: round(card.attrs.DEF * 0.5 + 25),
  };
}