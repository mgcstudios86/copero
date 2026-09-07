import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * MGC-1649 — WF3 season hub + week-decision: regresión estructural.
 *
 * Garantiza que el patrón de footer sticky (PR-394 box-none /
 * MGC-1381 altura fija) se mantenga. Si alguien mueve los CTAs
 * adentro del ScrollView, los índices caen antes del cierre y el
 * test rompe — mismo guard que `temporada.test.ts` ya usa.
 */
describe('season-hub screen — CTA footer fuera del ScrollView (MGC-1649)', () => {
  const src = readFileSync(resolve(__dirname, 'season-hub.tsx'), 'utf8');
  const scrollViewClose = src.indexOf('</ScrollView>');
  const decideBtn = src.indexOf('testID="btn-season-hub-decide"');
  const viewTableBtn = src.indexOf('testID="btn-season-hub-view-table"');

  it('cierra el ScrollView antes de declarar los CTAs', () => {
    expect(scrollViewClose).toBeGreaterThan(-1);
    expect(decideBtn).toBeGreaterThan(-1);
    expect(viewTableBtn).toBeGreaterThan(-1);
  });

  it('declara los CTAs FUERA del ScrollView', () => {
    expect(decideBtn).toBeGreaterThan(scrollViewClose);
    expect(viewTableBtn).toBeGreaterThan(scrollViewClose);
  });

  it('monta el footer con testID estable', () => {
    expect(src).toContain('testID="season-hub-cta-footer"');
  });

  it('reserva alto explícito en el footer', () => {
    const footer = src.slice(src.indexOf('testID="season-hub-cta-footer"'));
    expect(footer).toContain('height: ctaFooterHeight');
    expect(footer).toContain('flexBasis: ctaFooterHeight');
    expect(footer).toContain('flexGrow: 0');
    expect(footer).toContain('flexShrink: 0');
    expect(footer).toContain('collapsable={false}');
  });

  it('aplica hitSlop 44dp WCAG a ambos CTAs (PR-379 / MGC-1502)', () => {
    expect(src).toMatch(/btn-season-hub-decide[\s\S]*hitSlop/);
    expect(src).toMatch(/btn-season-hub-view-table[\s\S]*hitSlop/);
  });

  it('deja el ScrollView shrinkable para que el footer reserve su alto', () => {
    expect(src).toMatch(/scroll:\s*\{[^}]*flexShrink:\s*1/);
    expect(src).toContain('style={styles.scroll}');
  });

  it('no usa Pressable huérfano (los CTAs viven en <Button>)', () => {
    // El screen sólo debe importar Button para los CTAs; ningún Pressable
    // suelto que re-introduzca el patrón roto de PR-336.
    expect(src).not.toMatch(/^import\s+\{[^}]*Pressable/m);
  });
});

describe('week-decision screen — 4 opciones + footer (MGC-1649)', () => {
  const src = readFileSync(resolve(__dirname, 'week-decision.tsx'), 'utf8');
  const scrollViewClose = src.indexOf('</ScrollView>');

  it.each([
    'doble_turno',
    'turno_simple',
    'descanso',
    'entrenamiento_fisico_especifico',
  ])('declara la opción %s', (optionId) => {
    // Las opciones se generan con template literal `btn-week-option-${opt.id}`,
    // así que validamos que el id figure en el array de opciones (lo único
    // que el test estructural puede afirmar sin mockear React).
    expect(src).toContain(`id: '${optionId}'`);
  });

  it('usa el template `btn-week-option-${opt.id}` para los testID', () => {
    expect(src).toContain('btn-week-option-${opt.id}');
  });

  it('declara el footer de back FUERA del ScrollView', () => {
    const backIdx = src.indexOf('testID="btn-week-decision-back"');
    expect(backIdx).toBeGreaterThan(scrollViewClose);
  });

  it('aplica hitSlop 44dp a las opciones (PR-379)', () => {
    const optIdx = src.indexOf('btn-week-option-${opt.id}');
    const block = src.slice(optIdx, optIdx + 800);
    expect(block).toContain('hitSlop');
  });

  it('snapshotea vía weeklyChoice + flushPendingSave (careerStore MGC-273)', () => {
    // El onPick debe invocar `weeklyChoice` para que la persistencia
    // sincrónica sobreviva force-stop post-selección.
    expect(src).toContain('weeklyChoice(optionId)');
  });

  it('resolve matchweek para doble turno (patrón semanal.tsx)', () => {
    expect(src).toContain("if (optionId === 'doble_turno')");
    expect(src).toContain('resolveMatchweek()');
  });

  it('reserva alto explícito en el footer (PR-394 / MGC-1381)', () => {
    const footer = src.slice(src.indexOf('testID="week-decision-cta-footer"'));
    expect(footer).toContain('flexGrow: 0');
    expect(footer).toContain('flexShrink: 0');
    expect(footer).toContain('collapsable={false}');
  });
});