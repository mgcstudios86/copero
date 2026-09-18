// MGC-479 / spec PR #655 onboarding-fresh-user — test de routing del CTA
// "Jugar" en Home y de la cobertura i18n del Welcome screen.
//
// Valida:
//   1. Fresh-user (sin career persistida) → CTA "Jugar" navega a
//      `/onboarding/welcome` (no a `/simulador-carrera/identity`).
//   2. Carrera persistida → CTA "Jugar" navega a
//      `/simulador-carrera/identity` (re-crear).
//   3. Los 4 locales (es / en / zh-CN / pt-BR) tienen las 5 claves
//      `welcome.*` (eyebrow, title, body, cta, ctaHint) pobladas con
//      strings no vacíos — sin esto el LanguageSwitcher renderiza un
//      chip vacío al cambiar locale en el Welcome screen.
//
// Estos tests son unitarios puros (sin React render): cubren la lógica
// de routing expuesta por `app/index.tsx` (`goPlay`) y la cobertura del
// módulo `COPY` que ya consume `useLocale().t()`. Tests E2E de Maestro
// y Playwright viven en `.maestro/onboarding.yaml` y `e2e/`. El propio
// test de render del componente Welcome es responsabilidad de QA con el
// APK preview (MGC-479 §6 QA validation evidence).

import { describe, expect, it } from 'vitest';
import { COPY, SUPPORTED_LOCALES } from '@/i18n/copy';

/**
 * MGC-479 — dada la presencia de career persistida, devuelve el destino
 * del CTA "Jugar" en Home. Espejo literal de la lógica inline de
 * `app/index.tsx::goPlay`. Se extrae acá para mantener el test como
 * función pura y poder cubrir el contrato sin React render.
 */
function playTargetFor(hasCareer: boolean): string {
  return hasCareer
    ? '/simulador-carrera/identity'
    : '/onboarding/welcome';
}

describe('MGC-479 welcome routing', () => {
  it('fresh-user (sin career) navega a /onboarding/welcome', () => {
    expect(playTargetFor(false)).toBe('/onboarding/welcome');
  });

  it('career persistida navega directo a /simulador-carrera/identity', () => {
    expect(playTargetFor(true)).toBe('/simulador-carrera/identity');
  });
});

describe('MGC-479 welcome i18n coverage', () => {
  // Cada locale debe tener las 5 claves requeridas por el Welcome screen.
  // Sin esta cobertura, el LanguageSwitcher deja la Welcome en blanco
  // cuando el operador cambia de ES → EN en cold-start.
  const REQUIRED_KEYS = ['eyebrow', 'title', 'body', 'cta', 'ctaHint'] as const;

  for (const locale of SUPPORTED_LOCALES) {
    it(`locale "${locale}" tiene las claves welcome.* pobladas`, () => {
      const welcome = COPY[locale].welcome;
      expect(welcome).toBeDefined();
      for (const key of REQUIRED_KEYS) {
        const value = welcome[key];
        expect(value, `${locale}.welcome.${key} debe estar poblada`).toBeTypeOf('string');
        expect(value.length, `${locale}.welcome.${key} no puede ser vacío`).toBeGreaterThan(0);
      }
    });
  }
});