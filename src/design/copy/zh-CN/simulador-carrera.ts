/**
 * Copy matrix del simulador-carrera — locale zh-CN (MGC-2006).
 *
 * Mirror parcial de `es-AR/simulador-carrera.ts`. Esta primera iteración
 * cubre las 28 keys `social_*` (MGC-1738 / MGC-1762 / MGC-1903) que la UI
 * de F4 social events necesita para mostrar el evento sorteado + el
 * resumen de modificadores post-partido en chino simplificado. El resto
 * del catálogo sigue viviendo en `es-AR`; los consumidores deben usar el
 * helper `social-events-i18n.ts` para resolver la clave correcta según
 * locale.
 *
 * Voz: segunda persona, voz activa, chino simplificado (zh-CN).
 * Placeholders `{x}` se interpolan con `format(template, values)`.
 *
 * MGC-2006 — bloqueante P1-A del walk-report MGC-1763 (3 corridas
 * divergentes i18n es/en/zh-CN).
 */
import type { CopyEntry, CopyMatrix, FeedbackTone } from '../es-AR/simulador-carrera';
import { copy as esArCopy } from '../es-AR/simulador-carrera';

// Re-exportamos los tipos para que los consumidores no tengan que importar
// de la fuente es-AR sólo para tipar.
export type { CopyEntry, CopyMatrix, FeedbackTone };

// ── Helper local (mirror del `format` interno de es-AR; ese módulo no
//    lo exporta). La UI social sólo usa placeholders `\w+`, idéntico al
//    patrón de es-AR.
type Values = Record<string, string | number>;
const format = (template: string, values: Values = {}): string =>
  template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const v = values[key];
    return v === undefined ? `{${key}}` : String(v);
  });

// Subset i18n de las 28 keys social_* usadas por la pantalla F4
// (`social-events.tsx`) y por la card "Tu evento" del post-match.
// Mantenemos el mismo id que en es-AR para no romper la búsqueda
// `copy.resolve(id)` ni los tests existentes que verifican la matriz es-AR.

const SOCIAL_ENTRIES_ZH: Record<string, CopyEntry> = {
  // ── MGC-1738 / MGC-1762 — eventos sociales F4 ─────────────────────
  // 4 outcomes: timba / asado / tour / quedarse. Voz consistente con el
  // resto del catálogo zh-CN (segunda persona, chino simplificado).
  social_timba_title: { raw: '和朋友打牌', tone: 'warning' },
  social_timba_body: {
    raw: '你出门和朋友赌博,夜晚渐渐失控。',
  },
  social_asado_title: { raw: '在队友家吃烧烤' },
  social_asado_body: {
    raw: '烤肉、美酒和笑声。和兄弟们度过的安静夜晚。',
  },
  social_tour_title: { raw: '夜游酒吧街' },
  social_tour_body: {
    raw: '和小团体一起逛夜店。你精力充沛地回来了。',
  },
  social_quedarse_title: { raw: '你选择待在家' },
  social_quedarse_body: {
    raw: '安静的夜晚。你睡得很好,身体也很感激。',
  },
  social_outcome_mods_luck: { raw: '幸运加成:+{pct}%' },
  social_outcome_mods_injury: { raw: '受伤风险:x{val}' },
  social_outcome_mods_training: { raw: '训练加成:x{val}' },
  social_outcome_mods_fatigue: { raw: '疲劳:{delta}' },
  social_outcome_mods_moral: { raw: '士气:{delta}' },
  social_outcome_mods_confianza: { raw: '信心:{delta}' },
  social_locked_stats: {
    raw: '你需要关键属性足够高,幸运才能抵消代价。',
  },

  // ── MGC-1903 — pantalla F4 social-events (MGC-1738 / MGC-1762) ───
  // Chrome de la screen que consume `socialEventPending`.
  social_events_eyebrow: { raw: '社交事件' },
  social_events_title: { raw: '和朋友外出' },
  social_events_subtitle: {
    raw: '比赛结束了。今晚你做了什么?',
  },
  social_events_rolled_label: { raw: '你抽到' },
  social_events_rolled_a11y: {
    raw: '抽到的事件:{name}。{body}',
  },
  social_events_mods_title: { raw: '本周的修正值' },
  social_events_mods_empty: {
    raw: '无修正值。平静的一周。',
  },
  social_events_mods_odds_luck: {
    raw: '幸运:+{pct}%(阈值 {gate})',
  },
  social_events_mods_odds_luck_blocked: {
    raw: '幸运:阈值未通过(+0%)',
  },
  social_events_cta_continue: { raw: '继续' },
  social_events_cta_continue_hint: {
    raw: '返回主页。修正值已生效。',
  },
};

// Mezclamos: las social_* zh-CN pisan a las es-AR; el resto cae a es-AR.
const ENTRIES_ZH: Readonly<Record<string, CopyEntry>> = Object.freeze({
  ...esArCopy.entries,
  ...SOCIAL_ENTRIES_ZH,
});

/** Catálogo zh-CN: 28 social_* traducidas + fallback a es-AR para el resto. */
export const copy: CopyMatrix = {
  entries: ENTRIES_ZH,
  resolve(id, values) {
    const entry = ENTRIES_ZH[id];
    if (!entry) return `???${id}???`;
    return format(entry.raw, values);
  },
  tone(id): FeedbackTone {
    return ENTRIES_ZH[id]?.tone ?? 'neutral';
  },
};