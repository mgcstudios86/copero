import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regresión MGC-1381 — `btn-temporada-play` colapsado a 9dp.
 *
 * Historia: QA MGC-1378 midió `btn-temporada-play` en
 * [40,2121][1040,2130] (h=9dp) sobre ZY22G728HN con el APK de PR-336
 * (0ac3c76). PR-336 había intentado el fix con `flexDirection: 'column'`
 * + `flexShrink: 0` en cada hijo DENTRO del ScrollView — no alcanzó.
 *
 * `Button` fuerza `minHeight: max(52, tapTarget)` = 52dp, así que 9dp no
 * es un layout válido de Yoga: es el clipping de RN-Android sobre los
 * descendientes del ScrollView cuya y1 cae más allá del borde inferior
 * del viewport (UIAutomator reporta `getBoundsInScreen()` recortado).
 *
 * El único patrón que resolvió esto en el repo (MGC-807 field-map-section,
 * MGC-843 nationality-section, MGC-1351 identity-fixed-form) es extraer el
 * bloque del ScrollView a un sibling fijo con alto reservado. Estos tests
 * son el guard estructural para que nadie lo vuelva a meter adentro.
 */
describe('temporada screen — CTA footer fuera del ScrollView (MGC-1381)', () => {
  const src = readFileSync(resolve(__dirname, 'temporada.tsx'), 'utf8');
  const scrollViewClose = src.indexOf('</ScrollView>');
  const playButton = src.indexOf('testID="btn-temporada-play"');

  it('cierra el ScrollView antes de declarar los CTAs', () => {
    expect(scrollViewClose).toBeGreaterThan(-1);
    expect(playButton).toBeGreaterThan(-1);
  });

  it('declara btn-temporada-play FUERA del ScrollView', () => {
    // Si alguien vuelve a moverlo adentro, el índice cae antes del cierre.
    expect(playButton).toBeGreaterThan(scrollViewClose);
  });

  it.each([
    'btn-temporada-next-week',
    'btn-temporada-play',
    'btn-temporada-retire',
    'btn-temporada-retire-summary',
  ])('mantiene %s fuera del ScrollView', (testID) => {
    const idx = src.indexOf(`testID="${testID}"`);
    expect(idx).toBeGreaterThan(scrollViewClose);
  });

  it('monta el footer con testID estable para UIAutomator', () => {
    expect(src).toContain('testID="temporada-cta-footer"');
  });

  it('reserva alto explícito en el footer para no depender del measure pass', () => {
    const footer = src.slice(src.indexOf('testID="temporada-cta-footer"'));
    expect(footer).toContain('height: ctaFooterHeight');
    expect(footer).toContain('flexBasis: ctaFooterHeight');
    expect(footer).toContain('flexGrow: 0');
    expect(footer).toContain('flexShrink: 0');
    expect(footer).toContain('collapsable={false}');
  });

  it('calcula el presupuesto vertical sobre el minHeight real del Button lg', () => {
    // Button size="lg" => minHeight max(52, tapTarget=44) = 52.
    expect(src).toContain('const CTA_HEIGHT = 52');
    expect(src).toMatch(/ctaCount \* CTA_HEIGHT/);
  });

  it('deja de compensar el Banner con paddingBottom muerto', () => {
    // El <Banner /> del root layout es sibling flex, no overlay: el
    // paddingBottom +156 de PR-336 era espacio muerto que además no movía
    // el botón dentro del viewport.
    expect(src).not.toContain('spacing[4] + 156');
  });

  it('deja el ScrollView shrinkable para que el footer reserve su alto', () => {
    expect(src).toMatch(/scroll:\s*\{[^}]*flexShrink:\s*1/);
    expect(src).toContain('style={styles.scroll}');
  });
});
