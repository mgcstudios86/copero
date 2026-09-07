import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * MGC-1903 — F4 social events screen (MGC-1738 / MGC-1762).
 *
 * Regresión estructural del consumer que `resolveMatchweek` produce tras
 * `runSocialEvent`. Garantiza que:
 *
 *   - Los 4 outcomes (timba / asado / tour / quedarse) aparecen
 *     declarados en el screen.
 *   - El CTA "Continuar" está FUERA del ScrollView (footer sticky,
 *     mismo patrón que `season-hub.tsx`).
 *   - El botón drena `socialEventPending` con `clearPostMatch`
 *     (AC3 — MGC-1903).
 *   - El wiring desde post-match.tsx se mantiene: navegamos a
 *     `/simulador-carrera/social-events` cuando hay pending.
 *   - Los 4 outcomes tienen title + body en el catálogo de copy
 *     (`simulador-carrera.ts`).
 */
describe('social-events screen (MGC-1903)', () => {
  const src = readFileSync(
    resolve(__dirname, 'social-events.tsx'),
    'utf8',
  );
  const scrollViewClose = src.indexOf('</ScrollView>');
  const continueBtn = src.indexOf('testID="btn-social-events-continue"');
  const screenWrapper = src.indexOf('testID="social-events-screen"');

  it('monta el screen wrapper con testID estable', () => {
    expect(screenWrapper).toBeGreaterThan(-1);
  });

  it('declara el CTA "Continuar" FUERA del ScrollView', () => {
    expect(scrollViewClose).toBeGreaterThan(-1);
    expect(continueBtn).toBeGreaterThan(-1);
    expect(continueBtn).toBeGreaterThan(scrollViewClose);
  });

  it('declara los 4 outcomes esperados (timba / asado / tour / quedarse)', () => {
    expect(src).toContain('timba');
    expect(src).toContain('asado');
    expect(src).toContain('tour');
    expect(src).toContain('quedarse');
    expect(src).toMatch(/ALL_OUTCOMES:\s*readonly\s*SocialEventId\[\]/);
  });

  it('drena `socialEventPending` vía `clearPostMatch` (AC3)', () => {
    expect(src).toContain('clearPostMatch');
    expect(src).toMatch(/clearPostMatch\(\)/);
  });

  it('lee `socialEventPending` + `nextWeekModifiers` del store', () => {
    expect(src).toContain('useCareerStore');
    expect(src).toContain('socialEventPending');
    expect(src).toContain('nextWeekModifiers');
  });

  it('no re-rolea el evento (no llama runSocialEvent) — replay-safe', () => {
    // El motor ya consumió el RNG snapshot durante resolveMatchweek.
    // Re-rolar acá rompería la replay determinista. La pantalla sólo
    // consume el evento ya sorteado. Buscamos llamadas `runSocialEvent(`,
    // no la mención en comentario JSDoc.
    expect(src).not.toMatch(/[^/]runSocialEvent\s*\(/);
  });

  it('muestra los modificadores merged (no los del social crudo)', () => {
    expect(src).toContain('nextWeekModifiers');
    expect(src).toContain('social_outcome_mods_luck');
    expect(src).toContain('social_outcome_mods_injury');
    expect(src).toContain('social_outcome_mods_training');
    expect(src).toContain('social_outcome_mods_fatigue');
    expect(src).toContain('social_outcome_mods_moral');
    expect(src).toContain('social_outcome_mods_confianza');
  });

  it('aplica hitSlop al CTA "Continuar" (PR-379 / WCAG)', () => {
    expect(src).toMatch(/btn-social-events-continue[\s\S]*hitSlop/);
  });

  it('declara el footer con testID estable', () => {
    expect(src).toContain('testID="social-events-cta-footer"');
  });

  it('aplica collapsable={false} en el footer (RN-Android)', () => {
    expect(src).toMatch(/testID="social-events-cta-footer"[\s\S]*collapsable=\{false\}/);
  });

  it('no usa Pressable huérfano (los CTAs viven en <Button>)', () => {
    expect(src).not.toMatch(/^import\s+\{[^}]*Pressable/m);
  });

  it('redirige al dashboard si no hay socialEventPending', () => {
    expect(src).toContain('social-events-redirect');
    expect(src).toMatch(/simulador-carrera\/dashboard/);
  });
});

describe('post-match.tsx — wire a social-events (MGC-1903)', () => {
  const src = readFileSync(
    resolve(__dirname, 'post-match.tsx'),
    'utf8',
  );

  it('navega a /social-events cuando hay socialEventPending post commitMatch', () => {
    // AC del issue MGC-1903: tras commitMatch, si el motor roló un
    // evento social, la pantalla redirige a la F4 antes de volver al hub.
    expect(src).toContain('socialEventPending');
    expect(src).toMatch(/socialEventPending[\s\S]*simulador-carrera\/social-events/);
  });
});

describe('copy matrix (simulador-carrera.ts) — chrome F4 (MGC-1903)', () => {
  const src = readFileSync(
    resolve(__dirname, '../../../design/copy/es-AR/simulador-carrera.ts'),
    'utf8',
  );

  it.each([
    'social_events_eyebrow',
    'social_events_title',
    'social_events_subtitle',
    'social_events_rolled_label',
    'social_events_rolled_a11y',
    'social_events_mods_title',
    'social_events_mods_empty',
    'social_events_mods_odds_luck_blocked',
    'social_events_cta_continue',
    'social_events_cta_continue_hint',
  ])('declara la key `%s`', (key) => {
    expect(src).toContain(`${key}:`);
  });

  it.each([
    'social_timba_title',
    'social_timba_body',
    'social_asado_title',
    'social_asado_body',
    'social_tour_title',
    'social_tour_body',
    'social_quedarse_title',
    'social_quedarse_body',
    'social_outcome_mods_luck',
    'social_outcome_mods_injury',
    'social_outcome_mods_training',
    'social_outcome_mods_fatigue',
    'social_outcome_mods_moral',
    'social_outcome_mods_confianza',
    'social_locked_stats',
  ])('mantiene la key F4 preexistente `%s`', (key) => {
    expect(src).toContain(`${key}:`);
  });
});

describe('route wrapper `app/simulador-carrera/social-events.tsx` (MGC-1903)', () => {
  const src = readFileSync(
    resolve(__dirname, '../../../../app/simulador-carrera/social-events.tsx'),
    'utf8',
  );

  it('registra la ruta con lazy import del screen', () => {
    expect(src).toContain('lazy');
    expect(src).toContain('@/features/simulador-carrera/screens/social-events');
  });
});