/**
 * Copy matrix del simulador-carrera — locale en-US (MGC-2006).
 *
 * Mirror parcial de `es-AR/simulador-carrera.ts`. Esta primera iteración
 * cubre las 28 keys `social_*` (MGC-1738 / MGC-1762 / MGC-1903) que la UI
 * de F4 social events necesita para mostrar el evento sorteado + el
 * resumen de modificadores post-partido en inglés. El resto del catálogo
 * sigue viviendo en `es-AR`; los consumidores deben usar el helper
 * `social-events-i18n.ts` para resolver la clave correcta según locale.
 *
 * Voz: segunda persona singular, voz activa, inglés neutro (en-US).
 * Placeholders `{x}` se interpolan con `format(template, values)`.
 *
 * MGC-2006 — bloqueante P1-A del walk-report MGC-1763 (3 corridas
 * divergentes i18n es/en/zh-CN).
 */
import type { CopyEntry, CopyMatrix, FeedbackTone } from '../es-AR/simulador-carrera';
import { copy as esArCopy } from '../es-AR/simulador-carrera';

// ── Helper local (mirror del `format` interno de es-AR; ese módulo no
//    lo exporta). La UI social sólo usa placeholders `\w+`, idéntico al
//    patrón de es-AR.
type Values = Record<string, string | number>;
const format = (template: string, values: Values = {}): string =>
  template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const v = values[key];
    return v === undefined ? `{${key}}` : String(v);
  });

// Re-exportamos los tipos para que los consumidores no tengan que importar
// de la fuente es-AR sólo para tipar.
export type { CopyEntry, CopyMatrix, FeedbackTone };

// Subset i18n de las 28 keys social_* usadas por la pantalla F4
// (`social-events.tsx`) y por la card "Tu evento" del post-match.
// Mantenemos el mismo id que en es-AR para no romper la búsqueda
// `copy.resolve(id)` ni los tests existentes que verifican la matriz es-AR.

const SOCIAL_ENTRIES_EN: Record<string, CopyEntry> = {
  // ── MGC-1738 / MGC-1762 — eventos sociales F4 ─────────────────────
  // 4 outcomes: timba / asado / tour / quedarse. Voz consistente con el
  // resto del catálogo en-US (segunda persona, inglés neutro).
  social_timba_title: { raw: 'Card game with the lads', tone: 'warning' },
  social_timba_body: {
    raw: 'You went out betting with friends. The night got out of hand.',
  },
  social_asado_title: { raw: 'BBQ at a teammate’s place' },
  social_asado_body: {
    raw: 'Meat, wine and laughs. A chill night with the crew.',
  },
  social_tour_title: { raw: 'A night out on the town' },
  social_tour_body: {
    raw: 'Bar crawl with the group. You come back recharged.',
  },
  social_quedarse_title: { raw: 'You stayed home' },
  social_quedarse_body: {
    raw: 'A quiet night. You sleep well and your body thanks you.',
  },
  social_outcome_mods_luck: { raw: 'Luck bonus: +{pct}%' },
  social_outcome_mods_injury: { raw: 'Injury risk: x{val}' },
  social_outcome_mods_training: { raw: 'Training: x{val}' },
  social_outcome_mods_fatigue: { raw: 'Fatigue: {delta}' },
  social_outcome_mods_moral: { raw: 'Morale: {delta}' },
  social_outcome_mods_confianza: { raw: 'Confidence: {delta}' },
  social_locked_stats: {
    raw: 'You need the key stat high for luck to offset the cost.',
  },

  // ── MGC-1903 — pantalla F4 social-events (MGC-1738 / MGC-1762) ───
  // Chrome de la screen que consume `socialEventPending`.
  social_events_eyebrow: { raw: 'SOCIAL EVENT' },
  social_events_title: { raw: 'Night out with friends' },
  social_events_subtitle: {
    raw: 'The match is over. What did you do tonight?',
  },
  social_events_rolled_label: { raw: 'You rolled' },
  social_events_rolled_a11y: {
    raw: 'Rolled event: {name}. {body}',
  },
  social_events_mods_title: { raw: 'This week’s modifiers' },
  social_events_mods_empty: {
    raw: 'No modifiers. Neutral week.',
  },
  social_events_mods_odds_luck: {
    raw: 'Luck: +{pct}% (gate {gate})',
  },
  social_events_mods_odds_luck_blocked: {
    raw: 'Luck: gate failed (+0%)',
  },
  social_events_cta_continue: { raw: 'Continue' },
  social_events_cta_continue_hint: {
    raw: 'Head back to the hub. Modifiers are already applied.',
  },
};

// Mezclamos: las social_* en-US pisan a las es-AR; el resto cae a es-AR.
const ENTRIES_EN: Readonly<Record<string, CopyEntry>> = Object.freeze({
  ...esArCopy.entries,
  ...SOCIAL_ENTRIES_EN,
});

/** Catálogo en-US: 28 social_* traducidas + fallback a es-AR para el resto. */
export const copy: CopyMatrix = {
  entries: ENTRIES_EN,
  resolve(id, values) {
    const entry = ENTRIES_EN[id];
    if (!entry) return `???${id}???`;
    return format(entry.raw, values);
  },
  tone(id): FeedbackTone {
    return ENTRIES_EN[id]?.tone ?? 'neutral';
  },
};