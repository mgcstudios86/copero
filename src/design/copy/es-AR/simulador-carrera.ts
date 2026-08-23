/**
 * Copy matrix del simulador-carrera (MGC-439 → MGC-442).
 *
 * Fuente: design/simulador-carrera/copy-matrix.md.
 * Mapa motor→UI: el motor devuelve `copyId` (ej. 'modal_oferta_T1.body');
 * la UI resuelve `copy.matrix[id](values)` para obtener el string final.
 *
 * Convenciones:
 * - Voz: segunda persona singular (vos), voz activa, rioplatense.
 * - Placeholders `{x}` se interpolan con `format(template, values)`.
 * - Longitud: 80 ch feedback inline, 160 ch modales, 30 ch labels.
 * - Ningún copy contiene HTML/markdown. Solo texto plano.
 */

import type { FeedbackTone } from '@/types/career';

export type { FeedbackTone };

// ── Helpers ─────────────────────────────────────────────────────────

type Values = Record<string, string | number>;

const format = (template: string, values: Values = {}): string =>
  template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const v = values[key];
    return v === undefined ? `{${key}}` : String(v);
  });

const eur = (n: number) => `€${n.toLocaleString('es-AR')}`;

// ── Tipos públicos ─────────────────────────────────────────────────

export type CopyEntry = {
  /** String con placeholders `{x}`. */
  raw: string;
  tone?: FeedbackTone;
};

export type CopyMatrix = {
  /** Resuelve un copyId con valores. Fallback `???` si no existe. */
  resolve(id: string, values?: Values): string;
  /** Devuelve el tone asociado al copyId. */
  tone(id: string): FeedbackTone;
  /** Acceso directo al mapa de entries. */
  entries: Readonly<Record<string, CopyEntry>>;
};

// ── Catálogo completo ──────────────────────────────────────────────

const ENTRIES: Record<string, CopyEntry> = {
  // ── Pantalla 1: Define your identity (copy-matrix.md §1) ─────────
  identity_step: { raw: 'Paso 1 de 3' },
  identity_h1: { raw: 'Defendé tu identidad' },
  identity_h2_jersey: { raw: 'Tu camiseta' },
  identity_h2_position: { raw: 'Tu posición natural' },
  identity_h2_name: { raw: 'Tu nombre' },
  identity_h2_nationality: { raw: 'Tu nacionalidad' },
  identity_h2_foot: { raw: 'Tu pierna hábil' },
  identity_input_name_label: { raw: 'Nombre' },
  identity_input_name_ph: { raw: 'Lionel' },
  identity_input_last_label: { raw: 'Apellido' },
  identity_input_last_ph: { raw: 'Messi' },
  identity_input_number_label: { raw: 'Dorsal' },
  identity_input_number_suffix: { raw: '(1-99)' },
  identity_input_number_ph: { raw: '10' },
  identity_foot_toggle: { raw: 'Pierna hábil' },
  identity_foot_left: { raw: 'Zurdo' },
  identity_foot_right: { raw: 'Diestro' },
  identity_nat_ph: { raw: 'Buscar país' },
  identity_nat_empty: { raw: 'Sin coincidencias' },
  identity_error_empty_pos: { raw: 'Elegí una posición para continuar', tone: 'warning' },
  identity_error_name: { raw: 'Ingresá nombre y apellido', tone: 'warning' },
  identity_cta: { raw: 'Continuar a la academia' },
  identity_disclaimer: { raw: 'Ilustraciones estilizadas sin licencia oficial.' },

  // ── Pantalla 2: Player dashboard (copy-matrix.md §2) ─────────────
  dashboard_h1: { raw: '{name}' },
  dashboard_badge_number: { raw: '#{number}' },
  dashboard_badge_age: { raw: '{age} años' },
  dashboard_badge_position: { raw: '{posicion}' },
  dashboard_badge_value: { raw: '{valueEUR}' },
  dashboard_badge_value_free: { raw: 'Free agent' },
  dashboard_ovr_chip: { raw: 'OVR {ovr}' },
  dashboard_stats_h2: { raw: 'Tu temporada' },
  dashboard_stat_apps: { raw: 'Partidos' },
  dashboard_stat_goals: { raw: 'Goles' },
  dashboard_stat_ast: { raw: 'Asist.' },
  dashboard_trophy_empty_h2: { raw: 'Vitrina vacía' },
  dashboard_trophy_empty_p: { raw: 'Tu primer trofeo está a una decisión de distancia.' },
  dashboard_timeline_h2: { raw: 'Tu carrera' },
  dashboard_timeline_current: { raw: 'Hoy: {age} años' },
  dashboard_timeline_empty: { raw: 'Aún no fichaste por ningún club.' },
  dashboard_selection_h2: { raw: 'Selección nacional' },
  dashboard_selection_empty: { raw: 'Todavía no debutaste.' },
  dashboard_cta_training: { raw: 'Ir a entrenar' },
  dashboard_cta_match: { raw: 'Jugar la próxima fecha' },
  dashboard_cta_rest: { raw: 'Descansar esta semana' },
  dashboard_suggested_h2: { raw: 'Decisión sugerida' },

  // ── Pantalla 3: Academy offer (copy-matrix.md §3) ────────────────
  academy_step: { raw: 'Paso 3 de 3' },
  academy_h1: { raw: 'Elegí tu primer club' },
  academy_sub: { raw: 'Fichá por una academia y empezá tu carrera.' },
  academy_card_top: { raw: '{club} · Liga Profesional · Presupuesto alto' },
  academy_card_medium: { raw: '{club} · Primera Nacional · Presupuesto medio' },
  academy_card_low: { raw: '{club} · Primera Nacional · Presupuesto bajo · Semillero' },
  academy_selected_ring: { raw: 'Seleccionado' },
  academy_cta: { raw: 'Fichar por {club}' },
  academy_accept_cta: { raw: 'Fichar y empezar' },
  academy_disclaimer: { raw: 'Escudos ilustrativos sin licencia oficial.' },
  academy_back_cta: { raw: 'Volver al dashboard' },

  // ── Modales (copy-matrix.md §2 columna modal) ────────────────────
  modal_lesion_l1: { raw: 'Contractura. 1 fecha fuera. ¿Querés jugar igual?', tone: 'warning' },
  modal_lesion_l2: { raw: 'Desgarro. 3 fechas fuera. ¿Operación o reposo?', tone: 'danger' },
  modal_lesion_l3: { raw: 'Rotura de ligamentos. ¿Aceptás el retiro médico?', tone: 'danger' },
  modal_oferta_t1: { raw: '{club} te quiere. Sueldo: {sueldo}/mes. ¿Aceptás?', tone: 'neutral' },
  modal_oferta_o1: { raw: '{marca} te ofrece {monto}/temporada. ¿Firmamos?', tone: 'neutral' },
  modal_partido_m1: { raw: '¿Cómo salimos hoy? Conservadora / A todo / Líder' },
  modal_partido_m4: { raw: 'MVP del partido. ¿A quién se lo dedicás?' },
  modal_evento_v1: { raw: 'El plantel sale esta noche. ¿Te sumás?' },
  modal_evento_v3: { raw: 'El DT te deja afuera. ¿Plantás cara o cedés?' },
  modal_evento_v7: { raw: 'Multa por {motivo}: {monto}. ¿Pagás o apelás?', tone: 'warning' },

  // ── Estados visuales recurrentes ─────────────────────────────────
  state_loading_skeleton: { raw: 'Cargando tu carrera…', tone: 'neutral' },
  state_empty_career: { raw: 'Aún no fichaste por ningún club.', tone: 'neutral' },
  state_low_morale: { raw: 'Moral baja. Cuidate.', tone: 'warning' },
  state_injured: { raw: 'Lesionado · {fechas} fechas', tone: 'danger' },
  state_free_agent: { raw: 'Free agent', tone: 'neutral' },
  state_retired: { raw: 'Retirado. Tu legado queda en la vitrina.', tone: 'neutral' },
  state_contract_end: { raw: 'Tu contrato vence en {fechas} fechas', tone: 'warning' },
  state_picked_national: { raw: 'Convocado a selección', tone: 'success' },
  state_error_network: { raw: 'No pudimos cargar tu carrera. Reintentar', tone: 'danger' },

  // ── Feedback inline (copy-matrix.md tabla feedback) ──────────────
  feedback_gol: { raw: '¡GOOOL! +1 G.', tone: 'success' },
  feedback_asistencia: { raw: 'Asistencia. +1 A.', tone: 'success' },
  feedback_victoria: { raw: 'Triunfo {marcador}. Racha +1.', tone: 'success' },
  feedback_empate: { raw: 'Empate {marcador}. Sumamos.', tone: 'neutral' },
  feedback_derrota: { raw: 'Derrota {marcador}. A levantar.', tone: 'warning' },
  feedback_lesion_leve: { raw: 'Contractura. 1 fecha out.', tone: 'warning' },
  feedback_lesion_media: { raw: 'Desgarro. 3 fechas out.', tone: 'danger' },
  feedback_lesion_grave: { raw: 'Rotura LCA. Carrera en pausa.', tone: 'danger' },
  feedback_ovr_sube: { raw: 'OVR +1. Ahora {ovr}.', tone: 'success' },
  feedback_ovr_baja: { raw: 'OVR -1. Ahora {ovr}.', tone: 'warning' },
  feedback_atributo_sube: { raw: '+1 {atributo}.', tone: 'success' },
  feedback_racha_5: { raw: '5 al hilo. La hinchada te canta.', tone: 'success' },
  feedback_expulsion: { raw: 'Roja. {n} fechas afuera.', tone: 'danger' },
  feedback_oferta_incoming: { raw: '{club} viene por vos.', tone: 'neutral' },
  feedback_prensa_critica: { raw: 'La prensa te apunta.', tone: 'warning' },
  feedback_prensa_ensalza: { raw: 'La prensa te banca.', tone: 'success' },
  feedback_unknown: { raw: '', tone: 'neutral' },

  // ── Strategy options (consume strategy.ts) ───────────────────────
  training_e1_title: { raw: 'Ritmo alto' },
  training_e1_body: { raw: 'Doble turno mañana y tarde. Vas a llegar justo al sábado.' },
  training_e1_option: { raw: 'Aceptar ritmo alto' },
  feedback_e1_success: { raw: 'Buena semana. +1 físico.', tone: 'success' },
  feedback_e1_failure: { raw: 'No cuajó. -8 físico.', tone: 'warning' },

  training_e2_title: { raw: 'Técnico' },
  training_e2_body: { raw: 'Practicar pelotas paradas y definición. Paciencia.' },
  training_e2_option: { raw: 'Ir a entrenar pelotas paradas' },
  feedback_e2_success: { raw: '+1 técnico. Cuerpo técnico conforme.', tone: 'success' },
  feedback_e2_failure: { raw: 'Sin cambios esta semana.', tone: 'warning' },

  training_e3_title: { raw: 'Táctico' },
  training_e3_body: { raw: 'Estudiamos al próximo rival. Menos carga, más lectura.' },
  training_e3_option: { raw: 'Estudio táctico' },
  feedback_e3_success: { raw: 'Lectura útil. +1 mental.', tone: 'success' },

  training_e4_title: { raw: 'Descanso' },
  training_e4_body: { raw: 'Priorizamos recuperación. Nada de carga extra.' },
  training_e4_option: { raw: 'Descansar la semana' },
  feedback_e4_success: { raw: 'Cuerpo fresco. +18 físico.', tone: 'success' },

  training_e5_title: { raw: 'Individual' },
  training_e5_body: { raw: 'Sesión con el profe para pulir un atributo puntual.' },
  training_e5_option: { raw: 'Sesión individual' },
  feedback_e5_success: { raw: '+2 técnico. Puliste detalles.', tone: 'success' },
  feedback_e5_lesion: { raw: 'Te resentiste en la sesión.', tone: 'warning' },

  match_m1_title: { raw: 'Pre-partido' },
  match_m1_body: { raw: '¿Cómo salimos hoy?' },
  match_m1_conservadora: { raw: 'Actitud conservadora' },
  match_m1_todo: { raw: 'Ir con todo' },
  match_m1_lider: { raw: 'Pedir responsabilidades especiales' },
  feedback_match_safe: { raw: 'Salimos seguros. Esperando el segundo tiempo.', tone: 'neutral' },
  feedback_match_all_in: { raw: 'Salimos a ganar desde el minuto uno.', tone: 'success' },
  feedback_match_lead: { raw: 'El equipo te sigue. Capitán visible.', tone: 'success' },

  match_m2_title: { raw: 'Minuto 60' },
  match_m2_body: { raw: 'El DT te busca. ¿Qué hacés?' },
  match_m2_entrar: { raw: 'Pido entrar' },
  match_m2_aceptar: { raw: 'Acepto el rol y trabajo en silencio' },
  feedback_match_sub_in: { raw: 'Saltaste a la cancha con todo.', tone: 'success' },
  feedback_match_sub_out: { raw: 'Aceptaste el rol. El grupo lo nota.', tone: 'neutral' },

  match_m3_title: { raw: 'Resultado' },
  match_m3_aceptar: { raw: 'Aceptar y revisar' },
  feedback_match_resolved: { raw: 'Resultado cerrado. Próxima fecha.', tone: 'neutral' },

  match_m4_title: { raw: 'MVP' },
  match_m4_body: { raw: 'MVP del partido. ¿A quién se lo dedicás?' },
  match_m4_hinchada: { raw: 'A la hinchada' },
  match_m4_grupo: { raw: 'Al grupo' },
  match_m4_sin: { raw: 'Sin declaraciones' },
  feedback_match_mvp_hinchada: { raw: 'La tribuna te lo agradece.', tone: 'success' },
  feedback_match_mvp_grupo: { raw: 'El grupo lo celebra.', tone: 'success' },
  feedback_match_mvp_silent: { raw: 'MVP silencioso. La prensa lo nota.', tone: 'warning' },

  match_m5_title: { raw: 'Tarjeta roja' },
  match_m5_body: { raw: 'Roja directa. ¿Aceptás la sanción?' },
  match_m5_aceptar: { raw: 'Aceptar sanción' },
  feedback_match_red: { raw: 'Roja. {n} fechas afuera.', tone: 'danger' },

  transfer_t1_title: { raw: 'Oferta incoming' },
  transfer_t1_body: { raw: 'Tenés una oferta sobre la mesa.' },
  transfer_t1_aceptar: { raw: 'Aceptar y negociar sueldo' },
  transfer_t1_rechazar: { raw: 'Rechazar y renovar con mi club' },
  transfer_t1_pedir: { raw: 'Pedir más dinero al club actual' },
  feedback_transfer_accept: { raw: 'Nuevo club. Sube el sueldo.', tone: 'success' },
  feedback_transfer_reject: { raw: 'Te quedas. La confianza sube.', tone: 'success' },
  feedback_transfer_renegotiate: { raw: 'Renegociación en marcha.', tone: 'neutral' },

  transfer_t2_title: { raw: 'Oferta rechazada' },
  transfer_t2_body: { raw: 'La prensa pregunta por la oferta.' },
  transfer_t2_conciliador: { raw: 'Declaraciones conciliadoras' },
  transfer_t2_silencio: { raw: 'Silencio público' },
  feedback_transfer_soft: { raw: 'La baja la prensa con tu postura.', tone: 'neutral' },
  feedback_transfer_silent: { raw: 'Sin declaraciones. La pelota queda en el club.', tone: 'neutral' },

  transfer_t3_title: { raw: 'Negociación' },
  transfer_t3_body: { raw: 'Ajustá tu pretensión para destrabar la firma.' },
  transfer_t3_aceptar: { raw: 'Aceptar bono' },
  feedback_transfer_bonus: { raw: 'Bono firmado. {monto} extra.', tone: 'success' },

  transfer_t4_title: { raw: 'Cesión' },
  transfer_t4_body: { raw: 'Tu club ofrece cederten a un club menor.' },
  transfer_t4_aceptar: { raw: 'Aceptar cesión' },
  transfer_t4_plantar: { raw: 'Plantarse y quedarse' },
  feedback_loan_accept: { raw: 'Cesión firmada. Vas por minutos.', tone: 'neutral' },
  feedback_loan_refuse: { raw: 'Te quedás. A pelearla.', tone: 'success' },

  injury_l1_title: { raw: 'Lesión leve' },
  injury_l1_body: { raw: 'Contractura. 1 fecha fuera.' },
  injury_l1_jugar: { raw: 'Jugar igual' },
  injury_l1_recuperar: { raw: 'Recuperar bien' },
  feedback_injury_play: { raw: 'Jugas con dolor. Riesgo alto.', tone: 'warning' },
  feedback_injury_rest: { raw: 'Recuperación tranquila.', tone: 'success' },

  injury_l2_title: { raw: 'Lesión media' },
  injury_l2_body: { raw: 'Desgarro. 3 fechas fuera.' },
  injury_l2_operar: { raw: 'Operarme ya' },
  injury_l2_conservador: { raw: 'Tratamiento conservador' },
  feedback_injury_surgery: { raw: 'Operación OK. Vuelve antes.', tone: 'success' },
  feedback_injury_conservative: { raw: 'Reposo largo. 3 fechas sin jugar.', tone: 'warning' },

  injury_l3_title: { raw: 'Lesión grave' },
  injury_l3_body: { raw: 'Rotura de ligamentos. Tu carrera pende de un hilo.' },
  injury_l3_operar: { raw: 'Operación + 6 meses rehab' },
  injury_l3_retiro: { raw: 'Aceptar retiro médico' },
  feedback_injury_lca: { raw: 'Cirugía OK. Rehabilitación larga.', tone: 'danger' },
  feedback_injury_retire: { raw: 'Tu carrera termina acá. Leyenda respetada.', tone: 'danger' },

  reputation_r1_title: { raw: 'Estado de prensa' },
  reputation_r1_aceptar: { raw: 'Aceptar y revisar' },
  feedback_press_update: { raw: 'Tu estado de prensa cambió.', tone: 'neutral' },

  reputation_r2_title: { raw: 'Estado de hinchada' },
  reputation_r2_aceptar: { raw: 'Aceptar y revisar' },
  feedback_fans_update: { raw: 'Tu vínculo con la hinchada cambió.', tone: 'neutral' },

  reputation_r3_title: { raw: 'Estado de vestuario' },
  reputation_r3_aceptar: { raw: 'Aceptar y revisar' },
  feedback_locker_update: { raw: 'El grupo te mira distinto.', tone: 'neutral' },

  reputation_r4_title: { raw: 'Convocatoria selección' },
  reputation_r4_aceptar: { raw: 'Aceptar convocatoria' },
  feedback_national_call: { raw: 'Convocado a selección. La celeste te espera.', tone: 'success' },

  offer_o1_title: { raw: 'Patrocinador' },
  offer_o1_body: { raw: 'Una marca quiere asociarse a tu imagen.' },
  offer_o1_firmar: { raw: 'Firmar' },
  offer_o1_rechazar: { raw: 'Rechazar' },
  feedback_sponsor_sign: { raw: 'Sponsor firmado. {monto}/temporada.', tone: 'success' },
  feedback_sponsor_decline: { raw: 'Decidiste no asociarte. La oferta queda abierta.', tone: 'neutral' },

  offer_o2_title: { raw: 'Botines premium' },
  offer_o2_body: { raw: 'Una marca premium te regala botines.' },
  offer_o2_aceptar: { raw: 'Aceptar' },
  feedback_boots_sign: { raw: 'Botines nuevos. +1 técnico.', tone: 'success' },

  offer_o3_title: { raw: 'Representante' },
  offer_o3_body: { raw: 'Un agente se acerca para representarte.' },
  offer_o3_aceptar: { raw: 'Firmar con el agente' },
  feedback_agent_sign: { raw: 'Representación firmada. Mejores ofertas en camino.', tone: 'success' },

  offer_o4_title: { raw: 'Conferencia de prensa' },
  offer_o4_body: { raw: 'La prensa quiere tu palabra post-partido.' },
  offer_o4_honesto: { raw: 'Ser honesto' },
  offer_o4_polar: { raw: 'Declaración polarizante' },
  feedback_press_honest: { raw: 'Declaración tranquila. La prensa te respeta.', tone: 'success' },
  feedback_press_polar: { raw: 'Tu declaración sacudió a la prensa.', tone: 'warning' },

  event_v1_title: { raw: 'Fiesta del vestuario' },
  event_v1_body: { raw: 'El plantel sale esta noche.' },
  event_v1_ir: { raw: 'Sumarme' },
  event_v1_saltar: { raw: 'Saltar' },
  feedback_party_join: { raw: 'Buena noche. Moral alta.', tone: 'success' },
  feedback_party_skip: { raw: 'Te cuidaste. Confianza del grupo sube.', tone: 'success' },

  event_v2_title: { raw: 'Rumor de transferencia' },
  event_v2_body: { raw: 'Tu nombre suena para otro club.' },
  event_v2_negar: { raw: 'Negar todo' },
  event_v2_silencio: { raw: 'No comentar' },
  event_v2_admitir: { raw: 'Admitir interés' },
  feedback_rumor_deny: { raw: 'Negativa firme. Cierre de rumor.', tone: 'neutral' },
  feedback_rumor_silent: { raw: 'Silencio. La pelota queda en el club.', tone: 'neutral' },
  feedback_rumor_admit: { raw: 'Admitiste el interest. La prensa se enciende.', tone: 'warning' },

  event_v3_title: { raw: 'Conflicto con el DT' },
  event_v3_body: { raw: 'El DT te deja afuera.' },
  event_v3_plantar: { raw: 'Plantar cara' },
  event_v3_ceder: { raw: 'Ceder' },
  feedback_coach_stand: { raw: 'Marcaste posición. El DT lo piensa.', tone: 'success' },
  feedback_coach_yield: { raw: 'Cediste. La titularidad sigue.', tone: 'warning' },

  event_v4_title: { raw: 'Jugador estrella' },
  event_v4_body: { raw: 'Un compañero con OVR muy superior comparte plantel.' },
  event_v4_aprender: { raw: 'Aprender de él' },
  event_v4_diferencias: { raw: 'Marcar diferencias' },
  event_v4_ignorar: { raw: 'Ignorar' },
  feedback_star_learn: { raw: 'Sumás lectura del juego. +1 mental.', tone: 'success' },
  feedback_star_compete: { raw: 'Le marcaste diferencias. +1 técnico.', tone: 'success' },
  feedback_star_ignore: { raw: 'Lo dejaste pasar. La interna sigue.', tone: 'neutral' },

  event_v5_title: { raw: 'Aniversario del club' },
  event_v5_body: { raw: 'El club celebra su aniversario.' },
  event_v5_homenaje: { raw: 'Homenaje público' },
  event_v5_discreto: { raw: 'Discreto' },
  event_v5_saltar: { raw: 'Saltar' },
  feedback_anniversary_public: { raw: 'Homenaje popular. La hinchada te lo agradece.', tone: 'success' },
  feedback_anniversary_quiet: { raw: 'Presencia discreta.', tone: 'neutral' },
  feedback_anniversary_skip: { raw: 'Sin presencia. La hinchada lo nota.', tone: 'warning' },

  event_v6_title: { raw: 'Brote viral' },
  event_v6_body: { raw: 'Un video tuyo se hace viral.' },
  event_v6_capitalizar: { raw: 'Capitalizar' },
  event_v6_pasar: { raw: 'Dejar pasar' },
  feedback_viral_cash: { raw: 'Video monetizado. {monto} extra al presupuesto.', tone: 'success' },
  feedback_viral_skip: { raw: 'Lo dejaste pasar. La prensa lo cubre igual.', tone: 'neutral' },

  event_v7_title: { raw: 'Multa disciplinar' },
  event_v7_body: { raw: 'Conducta antideportiva. Multa encima.' },
  event_v7_pagar: { raw: 'Pagar y aprender' },
  event_v7_apelar: { raw: 'Apelar' },
  feedback_fine_pay: { raw: 'Multa pagada. -{monto}.', tone: 'warning' },
  feedback_fine_appeal: { raw: 'Apelación en curso. La decisión queda pendiente.', tone: 'neutral' },
};

/** Catálogo expuesto al motor y a la UI. Inmutable. */
export const copy: CopyMatrix = {
  entries: ENTRIES,
  resolve(id, values) {
    const entry = ENTRIES[id];
    if (!entry) return `???${id}???`;
    return format(entry.raw, values);
  },
  tone(id) {
    return ENTRIES[id]?.tone ?? 'neutral';
  },
};

/** Helpers tipados para los slots más usados por la UI. */
export const copyHelpers = {
  eur,
  badgeValue(valueEUR: number): string {
    return valueEUR > 0 ? eur(valueEUR) : copy.resolve('dashboard_badge_value_free');
  },
  ovrChip(ovr: number): string {
    return copy.resolve('dashboard_ovr_chip', { ovr });
  },
};