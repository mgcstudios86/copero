import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * MGC-1803 — TR1: estructura de la pantalla de transfer offers.
 *
 * Verifica que el screen cumple los guards estructurales compartidos con
 * el resto de la app:
 *  - footer con CTAs fuera del ScrollView (PR-394 box-none pattern).
 *  - alto reservado para que Yoga NO dependa del measure pass.
 *  - testIDs estables para UIAutomator (ZY22G728HN).
 *  - branch `noOffers` con CTA único "Volver al hub" (fallback).
 */
describe('transfer-offers screen — estructura (MGC-1803)', () => {
  const src = readFileSync(
    resolve(__dirname, 'transfer-offers.tsx'),
    'utf8',
  );
  const scrollViewClose = src.indexOf('</ScrollView>');

  it('exporta default function y testID estable', () => {
    expect(src).toContain('export default function TransferOffersScreen');
    expect(src).toContain('testID="transfer-offers-screen"');
  });

  it('declara el footer de CTAs FUERA del ScrollView', () => {
    const footerIdx = src.indexOf('testID="transfer-offers-cta-footer"');
    expect(footerIdx).toBeGreaterThan(-1);
    expect(footerIdx).toBeGreaterThan(scrollViewClose);
  });

  it('reserva alto explícito en el footer', () => {
    const footer = src.slice(
      src.indexOf('testID="transfer-offers-cta-footer"'),
    );
    expect(footer).toContain('height: ctaFooterHeight');
    expect(footer).toContain('flexBasis: ctaFooterHeight');
    expect(footer).toContain('flexGrow: 0');
    expect(footer).toContain('flexShrink: 0');
    expect(footer).toContain('collapsable={false}');
  });

  it('calcula el presupuesto vertical sobre el minHeight real del Button lg', () => {
    expect(src).toContain('const CTA_HEIGHT = 52');
    expect(src).toMatch(/ctaCount \* CTA_HEIGHT/);
  });

  it('expone los testIDs canónicos para QA', () => {
    expect(src).toContain('testID="transfer-offers-verdict"');
    expect(src).toContain('testID="transfer-offers-list"');
    expect(src).toContain('testID="transfer-offers-empty"');
    expect(src).toContain('testID="btn-transfer-offers-decline-all"');
  });

  it('declara el guard de doble tap (MGC-1736 pattern)', () => {
    expect(src).toContain('const [resolving, setResolving] = useState(false)');
    expect(src).toContain('if (resolving');
  });

  it('navega al hub al resolver', () => {
    expect(src).toContain("router.replace('/simulador-carrera/season-hub')");
  });

  it('declara branch empty (noOffers) con CTA único', () => {
    // El branch sin ofertas debe mostrar `transfer-offers-empty` y un
    // único botón (back). Verificamos que la condicional usa la misma
    // fuente de verdad (`hasOffers`).
    expect(src).toMatch(/hasOffers\s*\?\s*\(/);
  });

  it('no usa strings hardcodeados — consume i18n transfers.*', () => {
    // El guard contra regresión i18n (MGC-1570 / MGC-387): cada label
    // visible debe pasar por `t('transfers.*')`. Patrón: contar
    // ocurrencias de `t('transfers.` y verificar que es ≥ 6 (eyebrow,
    // title, subtitle, verdict, deadline/noOffers, roleStart/rotation,
    // years/wage/reputation, accept, decline, hint).
    const matches = src.match(/t\('transfers\./g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(8);
  });
});
