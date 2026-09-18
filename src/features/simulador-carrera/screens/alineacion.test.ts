import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * MGC-245 — alineacion screen: regression guard estructural.
 *
 * Verifica que el patrón canónico de la pantalla se mantenga en futuras
 * ediciones. Si alguien borra el CTA Confirmar, mueve los Pressable de
 * opción adentro del ScrollView en un orden distinto, o cambia el
 * testID del confirm, los índices caen y este test rompe — antes de
 * que QA reciba un APK con la pantalla rota.
 */
describe('alineacion screen — patrón canónico (MGC-245)', () => {
  const src = readFileSync(
    resolve(__dirname, 'alineacion.tsx'),
    'utf8',
  );

  it('existe el archivo y referencia los 3 IDs de opción', () => {
    expect(src.length).toBeGreaterThan(1000);
    expect(src).toMatch(/testID="alignment-option-conservadora"/);
    expect(src).toMatch(/testID="alignment-option-todo"/);
    expect(src).toMatch(/testID="alignment-option-lider"/);
  });

  it('expone el CTA Confirmar con testID estable', () => {
    expect(src).toMatch(/testID="btn-alineacion-confirm"/);
  });

  it('el CTA Confirmar tiene `disabled={!alignment}`', () => {
    // AC3 MGC-240 (parcial): botón deshabilitado hasta que el usuario
    // elija una opción. Si alguien borra el guard, el bug del
    // auto-play vuelve.
    expect(src).toMatch(/disabled=\{!alignment\}/);
  });

  it('importa setAlignment de matchStore', () => {
    expect(src).toMatch(/setAlignment.*@\/shared\/store\/matchStore/);
  });

  it('navega a /simulador-carrera/match tras confirmar', () => {
    expect(src).toMatch(/router\.push\(['"]\/simulador-carrera\/match['"]\)/);
  });

  it('exporta default React component', () => {
    expect(src).toMatch(/export default function AlineacionScreen/);
  });
});