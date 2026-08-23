/**
 * Reputación como pure function (MGC-439 §5 + §acceptance bar #6).
 *
 * Sin efectos secundarios. Dado un CareerStats devuelve una Reputation
 * consistente con las reglas de strategies.md:
 * - R1 Prensa: cada 3 partidos (week múltiplo de 3) se recalcula desde
 *   moral + racha.
 * - R2 Hinchada: racha + moral local.
 * - R3 Vestuario: conflictos, goles, liderato (proxy: moral del grupo ≈
 *   confianza del jugador en su club).
 * - R4 Selección: convocatoria automática cuando OVR ≥ 80, R2 ≥ aceptado,
 *   edad 18-34.
 */

import type {
  CareerStats,
  HinchadaReputation,
  PrensaReputation,
  Reputation,
  VestuarioReputation,
} from '@/types/career';

const clamp = (n: number) => Math.max(0, Math.min(99, n));

const moraleBand = (moral: number): PrensaReputation => {
  if (moral >= 75) return 'ensalzada';
  if (moral >= 50) return 'neutral';
  if (moral >= 25) return 'critica';
  return 'hostil';
};

const rachaBand = (racha: number, moral: number): HinchadaReputation => {
  if (racha >= 5 && moral >= 70) return 'idolo';
  if (racha >= 0 && moral >= 45) return 'aceptado';
  if (moral >= 30) return 'discutido';
  return 'odiado';
};

const vestuarioBand = (confianza: number, fisico: number): VestuarioReputation => {
  // Líder del grupo si confianza alta y físico sano.
  if (confianza >= 75 && fisico >= 60) return 'capitan_moral';
  if (confianza >= 40) return 'integrado';
  return 'aislado';
};

export function recomputeReputation(
  career: CareerStats,
  opts: { ovr: number; age: number; week: number },
): Reputation {
  const prensa: PrensaReputation = opts.week % 3 === 0 ? moraleBand(career.moral) : 'neutral';
  const hinchada: HinchadaReputation = rachaBand(career.racha, career.moral);
  const vestuario: VestuarioReputation = vestuarioBand(career.confianza, career.fisico);
  const seleccionConvocado =
    opts.ovr >= 80 && (hinchada === 'aceptado' || hinchada === 'idolo') && opts.age >= 18 && opts.age <= 34;

  return { prensa, hinchada, vestuario, seleccionConvocado };
}

/** OVR ponderado desde atributos (MGC-439). Pure function. */
export function recomputeOvr(attrs: {
  tecnico: number;
  fisico: number;
  mental: number;
  portero: number;
}): number {
  // Pesos para jugadores de campo; para GK usar recomputeOvrForPosition.
  const fieldAvg = Math.round((attrs.tecnico * 0.4 + attrs.fisico * 0.3 + attrs.mental * 0.3));
  return clamp(fieldAvg);
}

export function recomputeOvrForPosition(
  position: string,
  attrs: { tecnico: number; fisico: number; mental: number; portero: number },
): number {
  if (position === 'GK') {
    return Math.max(0, Math.min(99, Math.round(attrs.mental * 0.3 + attrs.portero * 0.5 + attrs.fisico * 0.2)));
  }
  // Arqueros pesan poco en fieldAvg; lo excluimos para no diluir.
  return Math.max(
    0,
    Math.min(99, Math.round(attrs.tecnico * 0.4 + attrs.fisico * 0.3 + attrs.mental * 0.3)),
  );
}