/**
 * Catálogo de decisiones del simulador-carrera (MGC-442).
 *
 * Fuente: design/simulador-carrera/strategies.md (MGC-439).
 * Cada item expone los IDs exactos (E1..V7) que consume el motor en
 * `simulation.ts`. El motor no lee copy: solo IDs, probabilidades,
 * condiciones y consecuencias.
 */

import type {
  AttributeKey,
  EventKind,
  PlayerProfile,
  StrategyId,
} from '@/types/career';

export type StatField =
  | 'moral'
  | 'fisico'
  | 'confianza'
  | 'presupuesto'
  | 'racha'
  | 'apps'
  | 'goals'
  | 'ast'
  | AttributeKey;

export type StatDelta = {
  field: StatField;
  delta: number;
};

export type StrategyOption = {
  id: string;
  copyId: string;
  /** Probabilidad de éxito. 1 = determinista. */
  prob: number;
  /** Delta de stat si la opción tiene éxito. */
  success: StatDelta[];
  /** Delta de stat si la opción falla (prob no se cumplió). */
  failure?: StatDelta[];
  /** Feedback inline a emitir (copyId del matrix). */
  feedback: { success: string; failure?: string };
};

export type Strategy = {
  id: StrategyId;
  kind: EventKind;
  title: string; // copyId
  body?: string; // copyId
  /** Condición evaluable: si `false`, la decisión no se ofrece. */
  condition?: (state: PlayerProfile) => boolean;
  options: StrategyOption[];
  /** Trigger explícito (MGC-439 §acceptance bar #7). */
  trigger: 'weekly' | 'match' | 'transfer' | 'injury' | 'milestone' | 'press' | 'sponsor';
};

/**
 * Catálogo. El orden de las options define el orden de los botones en UI.
 * Las copias se resuelven en el matrix `simulador-carrera.ts` por `copyId`.
 */
export const STRATEGIES: Record<StrategyId, Strategy> = {
  // ── 1. Entrenamiento ───────────────────────────────────────────────
  E1: {
    id: 'E1', kind: 'training', title: 'training_e1_title', body: 'training_e1_body', trigger: 'weekly',
    options: [
      {
        id: 'e1_accept', copyId: 'training_e1_option', prob: 0.8,
        success: [{ field: 'fisico', delta: -12 }, { field: 'fisico', delta: 1 }],
        failure: [{ field: 'fisico', delta: -8 }],
        feedback: { success: 'feedback_e1_success', failure: 'feedback_e1_failure' },
      },
    ],
  },
  E2: {
    id: 'E2', kind: 'training', title: 'training_e2_title', body: 'training_e2_body', trigger: 'weekly',
    options: [
      {
        id: 'e2_accept', copyId: 'training_e2_option', prob: 0.9,
        success: [{ field: 'fisico', delta: -5 }, { field: 'tecnico', delta: 1 }, { field: 'mental', delta: 1 }],
        failure: [{ field: 'fisico', delta: -3 }],
        feedback: { success: 'feedback_e2_success', failure: 'feedback_e2_failure' },
      },
    ],
  },
  E3: {
    id: 'E3', kind: 'training', title: 'training_e3_title', body: 'training_e3_body', trigger: 'weekly',
    options: [
      {
        id: 'e3_accept', copyId: 'training_e3_option', prob: 0.95,
        success: [{ field: 'fisico', delta: -3 }, { field: 'mental', delta: 1 }],
        feedback: { success: 'feedback_e3_success' },
      },
    ],
  },
  E4: {
    id: 'E4', kind: 'training', title: 'training_e4_title', body: 'training_e4_body', trigger: 'weekly',
    options: [
      {
        id: 'e4_accept', copyId: 'training_e4_option', prob: 1,
        success: [{ field: 'fisico', delta: 18 }, { field: 'moral', delta: -2 }],
        feedback: { success: 'feedback_e4_success' },
      },
    ],
  },
  E5: {
    id: 'E5', kind: 'training', title: 'training_e5_title', body: 'training_e5_body', trigger: 'weekly',
    options: [
      {
        id: 'e5_accept', copyId: 'training_e5_option', prob: 0.7,
        success: [{ field: 'fisico', delta: -8 }, { field: 'tecnico', delta: 2 }],
        failure: [{ field: 'fisico', delta: -12 }],
        feedback: { success: 'feedback_e5_success', failure: 'feedback_e5_lesion' },
      },
    ],
  },

  // ── 2. Partido ─────────────────────────────────────────────────────
  M1: {
    id: 'M1', kind: 'match', title: 'match_m1_title', body: 'match_m1_body', trigger: 'match',
    options: [
      { id: 'm1_conservadora', copyId: 'match_m1_conservadora', prob: 1,
        success: [{ field: 'fisico', delta: -10 }, { field: 'moral', delta: 3 }],
        feedback: { success: 'feedback_match_safe' } },
      { id: 'm1_todo', copyId: 'match_m1_todo', prob: 1,
        success: [{ field: 'fisico', delta: -20 }, { field: 'confianza', delta: 5 }],
        feedback: { success: 'feedback_match_all_in' } },
      { id: 'm1_lider', copyId: 'match_m1_lider', prob: 1,
        success: [{ field: 'moral', delta: 8 }, { field: 'confianza', delta: 4 }],
        feedback: { success: 'feedback_match_lead' } },
    ],
  },
  M2: {
    id: 'M2', kind: 'match', title: 'match_m2_title', body: 'match_m2_body', trigger: 'match',
    options: [
      { id: 'm2_entrar', copyId: 'match_m2_entrar', prob: 1,
        success: [{ field: 'moral', delta: 5 }, { field: 'confianza', delta: 3 }],
        feedback: { success: 'feedback_match_sub_in' } },
      { id: 'm2_aceptar', copyId: 'match_m2_aceptar', prob: 1,
        success: [{ field: 'moral', delta: -3 }],
        feedback: { success: 'feedback_match_sub_out' } },
    ],
  },
  M3: {
    id: 'M3', kind: 'match', title: 'match_m3_title', trigger: 'match',
    options: [
      { id: 'm3_aceptar', copyId: 'match_m3_aceptar', prob: 1,
        success: [], feedback: { success: 'feedback_match_resolved' } },
    ],
  },
  M4: {
    id: 'M4', kind: 'match', title: 'match_m4_title', body: 'match_m4_body', trigger: 'match',
    options: [
      { id: 'm4_hinchada', copyId: 'match_m4_hinchada', prob: 1,
        success: [{ field: 'moral', delta: 5 }],
        feedback: { success: 'feedback_match_mvp_hinchada' } },
      { id: 'm4_grupo', copyId: 'match_m4_grupo', prob: 1,
        success: [{ field: 'moral', delta: 3 }],
        feedback: { success: 'feedback_match_mvp_grupo' } },
      { id: 'm4_sin', copyId: 'match_m4_sin', prob: 1,
        success: [{ field: 'confianza', delta: -2 }],
        feedback: { success: 'feedback_match_mvp_silent' } },
    ],
  },
  M5: {
    id: 'M5', kind: 'match', title: 'match_m5_title', body: 'match_m5_body', trigger: 'match',
    options: [
      { id: 'm5_aceptar', copyId: 'match_m5_aceptar', prob: 1,
        success: [{ field: 'moral', delta: -10 }, { field: 'confianza', delta: -8 }],
        feedback: { success: 'feedback_match_red' } },
    ],
  },

  // ── 3. Transferencias ──────────────────────────────────────────────
  T1: {
    id: 'T1', kind: 'transfer', title: 'transfer_t1_title', body: 'transfer_t1_body', trigger: 'transfer',
    condition: (s) => s.clubInteres && s.clubPresupuesto > 0,
    options: [
      { id: 't1_aceptar', copyId: 'transfer_t1_aceptar', prob: 1,
        success: [{ field: 'presupuesto', delta: 12000 }, { field: 'moral', delta: 3 }],
        feedback: { success: 'feedback_transfer_accept' } },
      { id: 't1_rechazar', copyId: 'transfer_t1_rechazar', prob: 1,
        success: [{ field: 'moral', delta: -2 }, { field: 'confianza', delta: 5 }],
        feedback: { success: 'feedback_transfer_reject' } },
      { id: 't1_pedir', copyId: 'transfer_t1_pedir', prob: 1,
        success: [{ field: 'moral', delta: 1 }, { field: 'confianza', delta: 2 }],
        feedback: { success: 'feedback_transfer_renegotiate' } },
    ],
  },
  T2: {
    id: 'T2', kind: 'transfer', title: 'transfer_t2_title', body: 'transfer_t2_body', trigger: 'transfer',
    options: [
      { id: 't2_conciliador', copyId: 'transfer_t2_conciliador', prob: 1,
        success: [{ field: 'confianza', delta: 4 }],
        feedback: { success: 'feedback_transfer_soft' } },
      { id: 't2_silencio', copyId: 'transfer_t2_silencio', prob: 1,
        success: [{ field: 'confianza', delta: 1 }],
        feedback: { success: 'feedback_transfer_silent' } },
    ],
  },
  T3: {
    id: 'T3', kind: 'transfer', title: 'transfer_t3_title', body: 'transfer_t3_body', trigger: 'transfer',
    options: [
      { id: 't3_aceptar', copyId: 'transfer_t3_aceptar', prob: 1,
        success: [], feedback: { success: 'feedback_transfer_bonus' } },
    ],
  },
  T4: {
    id: 'T4', kind: 'transfer', title: 'transfer_t4_title', body: 'transfer_t4_body', trigger: 'transfer',
    condition: (s) => s.age < 23 && s.clubPresupuesto < 2,
    options: [
      { id: 't4_aceptar', copyId: 'transfer_t4_aceptar', prob: 1,
        success: [{ field: 'moral', delta: -5 }],
        feedback: { success: 'feedback_loan_accept' } },
      { id: 't4_plantar', copyId: 'transfer_t4_plantar', prob: 1,
        success: [{ field: 'moral', delta: 2 }],
        feedback: { success: 'feedback_loan_refuse' } },
    ],
  },

  // ── 4. Lesiones ────────────────────────────────────────────────────
  L1: {
    id: 'L1', kind: 'injury', title: 'injury_l1_title', body: 'injury_l1_body', trigger: 'injury',
    options: [
      { id: 'l1_jugar', copyId: 'injury_l1_jugar', prob: 1,
        success: [{ field: 'fisico', delta: -25 }],
        feedback: { success: 'feedback_injury_play' } },
      { id: 'l1_recuperar', copyId: 'injury_l1_recuperar', prob: 1,
        success: [{ field: 'fisico', delta: 5 }],
        feedback: { success: 'feedback_injury_rest' } },
    ],
  },
  L2: {
    id: 'L2', kind: 'injury', title: 'injury_l2_title', body: 'injury_l2_body', trigger: 'injury',
    options: [
      { id: 'l2_operar', copyId: 'injury_l2_operar', prob: 1,
        success: [{ field: 'presupuesto', delta: -1500 }],
        feedback: { success: 'feedback_injury_surgery' } },
      { id: 'l2_conservador', copyId: 'injury_l2_conservador', prob: 1,
        success: [], feedback: { success: 'feedback_injury_conservative' } },
    ],
  },
  L3: {
    id: 'L3', kind: 'injury', title: 'injury_l3_title', body: 'injury_l3_body', trigger: 'injury',
    options: [
      { id: 'l3_operar', copyId: 'injury_l3_operar', prob: 1,
        success: [{ field: 'tecnico', delta: -3 }, { field: 'mental', delta: -10 }],
        feedback: { success: 'feedback_injury_lca' } },
      { id: 'l3_retiro', copyId: 'injury_l3_retiro', prob: 1,
        success: [{ field: 'moral', delta: -30 }],
        feedback: { success: 'feedback_injury_retire' } },
    ],
  },

  // ── 5. Reputación ──────────────────────────────────────────────────
  R1: { id: 'R1', kind: 'reputation', title: 'reputation_r1_title', trigger: 'press',
    options: [{ id: 'r1_aceptar', copyId: 'reputation_r1_aceptar', prob: 1, success: [], feedback: { success: 'feedback_press_update' } }] },
  R2: { id: 'R2', kind: 'reputation', title: 'reputation_r2_title', trigger: 'press',
    options: [{ id: 'r2_aceptar', copyId: 'reputation_r2_aceptar', prob: 1, success: [], feedback: { success: 'feedback_fans_update' } }] },
  R3: { id: 'R3', kind: 'reputation', title: 'reputation_r3_title', trigger: 'milestone',
    options: [{ id: 'r3_aceptar', copyId: 'reputation_r3_aceptar', prob: 1, success: [], feedback: { success: 'feedback_locker_update' } }] },
  R4: { id: 'R4', kind: 'reputation', title: 'reputation_r4_title', trigger: 'milestone',
    options: [{ id: 'r4_aceptar', copyId: 'reputation_r4_aceptar', prob: 1,
      success: [{ field: 'moral', delta: 5 }], feedback: { success: 'feedback_national_call' } }] },

  // ── 6. Ofertas ─────────────────────────────────────────────────────
  O1: { id: 'O1', kind: 'offer', title: 'offer_o1_title', body: 'offer_o1_body', trigger: 'sponsor',
    options: [
      { id: 'o1_firmar', copyId: 'offer_o1_firmar', prob: 1,
        success: [{ field: 'presupuesto', delta: 50000 }],
        feedback: { success: 'feedback_sponsor_sign' } },
      { id: 'o1_rechazar', copyId: 'offer_o1_rechazar', prob: 1,
        success: [], feedback: { success: 'feedback_sponsor_decline' } },
    ] },
  O2: { id: 'O2', kind: 'offer', title: 'offer_o2_title', body: 'offer_o2_body', trigger: 'sponsor',
    options: [
      { id: 'o2_aceptar', copyId: 'offer_o2_aceptar', prob: 1,
        success: [{ field: 'tecnico', delta: 1 }, { field: 'moral', delta: 5 }],
        feedback: { success: 'feedback_boots_sign' } },
    ] },
  O3: { id: 'O3', kind: 'offer', title: 'offer_o3_title', body: 'offer_o3_body', trigger: 'milestone',
    options: [
      { id: 'o3_aceptar', copyId: 'offer_o3_aceptar', prob: 1,
        success: [{ field: 'moral', delta: 3 }],
        feedback: { success: 'feedback_agent_sign' } },
    ] },
  O4: { id: 'O4', kind: 'offer', title: 'offer_o4_title', body: 'offer_o4_body', trigger: 'press',
    options: [
      { id: 'o4_honesto', copyId: 'offer_o4_honesto', prob: 1,
        success: [{ field: 'moral', delta: 2 }],
        feedback: { success: 'feedback_press_honest' } },
      { id: 'o4_polar', copyId: 'offer_o4_polar', prob: 1,
        success: [{ field: 'confianza', delta: 3 }, { field: 'moral', delta: -1 }],
        feedback: { success: 'feedback_press_polar' } },
    ] },

  // ── 7. Eventos ─────────────────────────────────────────────────────
  V1: { id: 'V1', kind: 'event', title: 'event_v1_title', body: 'event_v1_body', trigger: 'milestone',
    condition: (s) => s.career.racha >= 3,
    options: [
      { id: 'v1_ir', copyId: 'event_v1_ir', prob: 1,
        success: [{ field: 'moral', delta: 10 }, { field: 'fisico', delta: -5 }],
        feedback: { success: 'feedback_party_join' } },
      { id: 'v1_saltar', copyId: 'event_v1_saltar', prob: 1,
        success: [{ field: 'confianza', delta: 3 }],
        feedback: { success: 'feedback_party_skip' } },
    ] },
  V2: { id: 'V2', kind: 'event', title: 'event_v2_title', body: 'event_v2_body', trigger: 'press',
    options: [
      { id: 'v2_negar', copyId: 'event_v2_negar', prob: 1, success: [], feedback: { success: 'feedback_rumor_deny' } },
      { id: 'v2_silencio', copyId: 'event_v2_silencio', prob: 1, success: [], feedback: { success: 'feedback_rumor_silent' } },
      { id: 'v2_admitir', copyId: 'event_v2_admitir', prob: 1, success: [], feedback: { success: 'feedback_rumor_admit' } },
    ] },
  V3: { id: 'V3', kind: 'event', title: 'event_v3_title', body: 'event_v3_body', trigger: 'milestone',
    condition: (s) => s.career.racha < 0 && s.career.moral < 40,
    options: [
      { id: 'v3_plantar', copyId: 'event_v3_plantar', prob: 1,
        success: [{ field: 'moral', delta: 15 }],
        feedback: { success: 'feedback_coach_stand' } },
      { id: 'v3_ceder', copyId: 'event_v3_ceder', prob: 1,
        success: [{ field: 'moral', delta: -10 }],
        feedback: { success: 'feedback_coach_yield' } },
    ] },
  V4: { id: 'V4', kind: 'event', title: 'event_v4_title', body: 'event_v4_body', trigger: 'milestone',
    options: [
      { id: 'v4_aprender', copyId: 'event_v4_aprender', prob: 1,
        success: [{ field: 'mental', delta: 1 }],
        feedback: { success: 'feedback_star_learn' } },
      { id: 'v4_diferencias', copyId: 'event_v4_diferencias', prob: 1,
        success: [{ field: 'tecnico', delta: 1 }],
        feedback: { success: 'feedback_star_compete' } },
      { id: 'v4_ignorar', copyId: 'event_v4_ignorar', prob: 1,
        success: [], feedback: { success: 'feedback_star_ignore' } },
    ] },
  V5: { id: 'V5', kind: 'event', title: 'event_v5_title', body: 'event_v5_body', trigger: 'milestone',
    options: [
      { id: 'v5_homenaje', copyId: 'event_v5_homenaje', prob: 1,
        success: [{ field: 'moral', delta: 5 }],
        feedback: { success: 'feedback_anniversary_public' } },
      { id: 'v5_discreto', copyId: 'event_v5_discreto', prob: 1,
        success: [], feedback: { success: 'feedback_anniversary_quiet' } },
      { id: 'v5_saltar', copyId: 'event_v5_saltar', prob: 1,
        success: [{ field: 'moral', delta: -3 }],
        feedback: { success: 'feedback_anniversary_skip' } },
    ] },
  V6: { id: 'V6', kind: 'event', title: 'event_v6_title', body: 'event_v6_body', trigger: 'milestone',
    options: [
      { id: 'v6_capitalizar', copyId: 'event_v6_capitalizar', prob: 1,
        success: [{ field: 'presupuesto', delta: 10000 }],
        feedback: { success: 'feedback_viral_cash' } },
      { id: 'v6_pasar', copyId: 'event_v6_pasar', prob: 1,
        success: [], feedback: { success: 'feedback_viral_skip' } },
    ] },
  V7: { id: 'V7', kind: 'event', title: 'event_v7_title', body: 'event_v7_body', trigger: 'milestone',
    options: [
      { id: 'v7_pagar', copyId: 'event_v7_pagar', prob: 1,
        success: [{ field: 'presupuesto', delta: -2000 }],
        feedback: { success: 'feedback_fine_pay' } },
      { id: 'v7_apelar', copyId: 'event_v7_apelar', prob: 1,
        success: [], feedback: { success: 'feedback_fine_appeal' } },
    ] },
};

export const WEEKLY_STRATEGIES: StrategyId[] = ['E1', 'E2', 'E3', 'E4', 'E5'];
export const MATCH_STRATEGIES: StrategyId[] = ['M1', 'M2', 'M3', 'M4', 'M5'];
export const TRANSFER_STRATEGIES: StrategyId[] = ['T1', 'T2', 'T3', 'T4'];
export const INJURY_STRATEGIES: StrategyId[] = ['L1', 'L2', 'L3'];
export const OFFER_STRATEGIES: StrategyId[] = ['O1', 'O2', 'O3', 'O4'];
export const EVENT_STRATEGIES: StrategyId[] = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7'];