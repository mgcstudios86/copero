import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  deriveContrastDorsal,
  DORSAL_CANDIDATES,
  DORSAL_CREAM,
  DORSAL_INK,
  relativeLuminance,
  worstContrastRatio,
  type JerseyLayers,
} from './jersey-contrast';

/**
 * MGC-1950 — regresiones para los hallazgos del CTO en review de
 * PR #464 (SHA 112b60f):
 *
 *  1. TS2322: el helper `deriveContrastDorsal` existe y se invoca desde
 *     JerseyPreview con paleta sin `dorsal` (resuelve type-check).
 *  2. WCAG: el algoritmo maximiza el peor ratio contra las 3 capas
 *     (primary/secondary/accent) y NO usa el umbral `lum > 0.5` roto
 *     de PR #464.
 *  3. Boca azul+amarillo y paletas monocromáticas caen al MEJOR de los
 *     2 candidatos, con reporte explícito del worst-case ratio.
 *
 * Los helpers viven en `./jersey-contrast` (sin React) para ser
 * testeables sin react-test-renderer (MGC-363).
 */

describe('MGC-1950 relativeLuminance (WCAG 2.x)', () => {
  it('black → 0', () => {
    expect(relativeLuminance('#000000')).toBe(0);
  });

  it('white → 1', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('fallback neutro para hex inválido', () => {
    expect(relativeLuminance('not-a-color')).toBe(0.5);
    expect(relativeLuminance('#FFF')).toBe(0.5); // hex corto, no soportado
    expect(relativeLuminance('')).toBe(0.5);
  });

  it('gray medio (#808080) tiene luminancia < 0.5 (regresión)', () => {
    // Caso del CTO en review de PR #464: el algoritmo viejo usaba
    // `lum > 0.5` para elegir el color del dorsal; #808080 → lum≈0.215
    // forzaba '#F4F1EB' aunque el ratio fuera < 4.5:1.
    const lum = relativeLuminance('#808080');
    expect(lum).toBeLessThan(0.5);
    expect(lum).toBeGreaterThan(0.2);
  });
});

describe('MGC-1950 contrastRatio (WCAG 2.x)', () => {
  it('black vs white = 21:1 (máximo WCAG)', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('cream (#F4F1EB) vs gray (#808080) < 4.5:1 (regresión del CTO)', () => {
    // El CTO demostró: con el umbral viejo `lum > 0.5`, gray #808080
    // forzaba dorsal #F4F1EB → ratio 3.50:1 (falla WCAG AA).
    const ratio = contrastRatio('#F4F1EB', '#808080');
    expect(ratio).toBeLessThan(4.5);
    expect(ratio).toBeCloseTo(3.5, 0);
  });

  it('ink (#0E1116) vs Boca yellow (#FBBF24) > 4.5:1 (caso Boca)', () => {
    const ratio = contrastRatio('#0E1116', '#FBBF24');
    expect(ratio).toBeGreaterThan(4.5);
  });

  it('cream (#F4F1EB) vs Boca blue (#0A2A6B) > 4.5:1 (caso Boca)', () => {
    const ratio = contrastRatio('#F4F1EB', '#0A2A6B');
    expect(ratio).toBeGreaterThan(4.5);
  });

  it('cream vs Boca yellow (#FBBF24) < 4.5:1 (caso Boca peor-caso)', () => {
    // CTO review: cream sobre amarillo Boca = 1.48:1.
    const ratio = contrastRatio('#F4F1EB', '#FBBF24');
    expect(ratio).toBeLessThan(4.5);
    expect(ratio).toBeCloseTo(1.48, 0);
  });

  it('ink vs Boca blue (#0A2A6B) < 4.5:1 (caso Boca peor-caso)', () => {
    const ratio = contrastRatio('#0E1116', '#0A2A6B');
    expect(ratio).toBeLessThan(4.5);
    expect(ratio).toBeCloseTo(1.48, 0);
  });
});

describe('MGC-1950 worstContrastRatio', () => {
  it('primario monocromático claro (white): ink worst ≈ 18.9:1 (no 21)', () => {
    // El candidato ink es #0E1116 (casi negro, pero no puro). contrast
    // con blanco es ≈ 18.9:1, no el 21:1 teórico de negro/blanco.
    const layers: JerseyLayers = {
      primary: '#FFFFFF',
      secondary: '#FFFFFF',
      accent: '#FFFFFF',
    };
    const inkWorst = worstContrastRatio(DORSAL_INK, layers);
    const creamWorst = worstContrastRatio(DORSAL_CREAM, layers);
    expect(inkWorst).toBeGreaterThan(18);
    expect(inkWorst).toBeLessThan(20);
    // Cream sobre cream ≈ 1.1:1 (inservible).
    expect(creamWorst).toBeGreaterThan(1);
    expect(creamWorst).toBeLessThan(1.2);
  });

  it('primario monocromático oscuro (black): cream worst ≈ 18.6:1', () => {
    const layers: JerseyLayers = {
      primary: '#000000',
      secondary: '#000000',
      accent: '#000000',
    };
    const inkWorst = worstContrastRatio(DORSAL_INK, layers);
    const creamWorst = worstContrastRatio(DORSAL_CREAM, layers);
    // Ink sobre ink ≈ 1.1:1 (inservible).
    expect(inkWorst).toBeGreaterThan(1);
    expect(inkWorst).toBeLessThan(1.2);
    expect(creamWorst).toBeGreaterThan(18);
    expect(creamWorst).toBeLessThan(20);
  });
});

describe('MGC-1950 deriveContrastDorsal', () => {
  it('Boca (azul + amarillo): devuelve uno de los 2 candidatos y reporta worst', () => {
    // Boca: primary azul, secondary/accent amarillo.
    // ink worst = min(1.48, 1.48, 11) = 1.48
    // cream worst = min(11, 1.48, 1.48) = 1.48
    // Empate técnico worst-case — algoritmo elige ink por orden de
    // iteración. Lo importante es que NUNCA devuelve un color arbitrario
    // (regresión del CTO: antes derivaba según lum(primary) que es
    // determinista pero erróneo para la capa accent).
    const result = deriveContrastDorsal({
      primary: '#0A2A6B',
      secondary: '#FBBF24',
      accent: '#FBBF24',
    });
    expect(DORSAL_CANDIDATES).toContain(result.color);
    // Worst-case Boca es < 4.5:1 (es la limitación inherente al tener
    // amarillo + azul complementarios). El algoritmo es honesto: lo
    // reporta en `worstRatio` para que QA walks lo flaggee.
    expect(result.worstRatio).toBeLessThan(4.5);
    expect(result.worstRatio).toBeGreaterThan(1);
  });

  it('monocromo claro (white): devuelve ink con worst ≥ 18:1', () => {
    const result = deriveContrastDorsal({
      primary: '#FFFFFF',
      secondary: '#FFFFFF',
      accent: '#FFFFFF',
    });
    expect(result.color).toBe(DORSAL_INK);
    expect(result.worstRatio).toBeGreaterThan(18);
  });

  it('monocromo oscuro (black): devuelve cream con worst ≥ 18:1', () => {
    const result = deriveContrastDorsal({
      primary: '#000000',
      secondary: '#000000',
      accent: '#000000',
    });
    expect(result.color).toBe(DORSAL_CREAM);
    expect(result.worstRatio).toBeGreaterThan(18);
  });

  it('capas mixtas: elige el mejor worst-case aunque ninguno pase 4.5:1', () => {
    // primary blanco + accent rojo oscuro (#7A0A18): para cream el
    // worst-case lo domina cream-vs-white ≈ 1.1:1; para ink el worst
    // lo domina ink-vs-red ≈ 1.7:1. ink gana (1.7 > 1.1) pero ninguno
    // llega a 4.5:1. El algoritmo reporta el worst honestamente.
    const result = deriveContrastDorsal({
      primary: '#FFFFFF',
      secondary: '#FFFFFF',
      accent: '#7A0A18',
    });
    expect(DORSAL_CANDIDATES).toContain(result.color);
    expect(result.worstRatio).toBeLessThan(4.5);
  });

  it('NO usa el umbral roto `lum > 0.5` (regresión específica del CTO)', () => {
    // Caso gray #808080 que el CTO usó como contraejemplo:
    //  - algoritmo viejo: lum(gray) ≈ 0.215 < 0.5 → '#F4F1EB'
    //  - algoritmo nuevo: worst-case(#F4F1EB, [#808080]) = 3.50:1,
    //    worst-case(#0E1116, [#808080]) = 5.66:1 → elige ink.
    const result = deriveContrastDorsal({
      primary: '#808080',
      secondary: '#808080',
      accent: '#808080',
    });
    expect(result.color).toBe(DORSAL_INK);
    expect(result.worstRatio).toBeGreaterThan(4.5);
  });
});
