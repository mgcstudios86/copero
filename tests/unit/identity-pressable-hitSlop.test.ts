/**
 * MGC-2131 / PR #482 — Regresión automatizada del fix MGC-2081
 * (country Pressable sin hitSlop).
 *
 * El bug original (MGC-1763 walk F4 / MGC-2081): el Pressable de cada
 * fila de país (`country-${code}`) vivía dentro del outer ScrollView,
 * con `parent overflow: 'hidden'` y `hitSlop={HIT_SLOP_44}`. El hitSlop
 * expandía los bounds visuales fuera del layout real, y el gesture
 * handler del ScrollView capturaba el touch DOWN antes del UP, lo que
 * cancelaba el `onPress`. Resultado: el handler de `selectNationality`
 * nunca ejecutaba, `nationalityCode` quedaba null, y `btn-identity-continue`
 * quedaba disabled. El fix en PR #482 quita `hitSlop` de ese Pressable.
 *
 * Estos tests son guardia de regresión contra cualquier re-introducción:
 *
 *   1. Existe exactamente UN Pressable con `testID={\`country-${...}\`}`.
 *   2. Ese Pressable NO define la prop `hitSlop`.
 *   3. El archivo menciona explícitamente MGC-2081 + la nota "sin
 *      hitSlop" (anti-regresión documental).
 *   4. El comentario MGC-2081 justifica el cambio (anti-regresión de
 *      comprensión del fix: el lector debe saber por qué se quitó).
 *
 * Patrón equivalente al que ya existe en
 * `tests/unit/identity-layout-fx1.test.ts` (MGC-1739): parseo estático
 * del source para evitar acoplar el test al runtime de React Native.
 *
 * Refs:
 *   - PR #482 (commit 0b9cdf2 + d76a0181 sobre base 615d7f7)
 *   - MGC-2081 (issue)
 *   - MGC-1763 (walk F4 social-events, parent bloqueado)
 *   - MGC-1652 (PR-379 WCAG 2.5.5 patrón hitSlop 44dp — revertido
 *     SOLO en este chip)
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const IDENTITY_SRC = readFileSync(
  resolve(__dirname, '../../src/features/simulador-carrera/screens/identity.tsx'),
  'utf8',
);

/**
 * Extrae el bloque Pressable que contiene el `testID` cuyo valor
 * empieza con `country-`. Asume una sola ocurrencia (el `.map()` de
 * `filteredNationalities` renderiza muchas filas a partir de UNA
 * definición de Pressable). El balanceo de `<Pressable ... />` /
 * `<Pressable ...>...</Pressable>` se hace contando aperturas vs
 * cierres desde el offset del match inicial.
 */
function extractCountryPressableBlock(src: string): string {
  const testIdIdx = src.search(/testID=\{?`country-\$\{/);
  expect(testIdIdx, 'No se encontró testID con patrón country-${...} en identity.tsx').toBeGreaterThan(-1);

  // Retrocede desde el testID hasta el `<Pressable` anterior más cercano.
  const openIdx = src.lastIndexOf('<Pressable', testIdIdx);
  expect(openIdx, 'No se encontró <Pressable antes del testID country-*').toBeGreaterThan(-1);

  // Avanza desde `<Pressable` contando aperturas/cierres hasta balancear.
  let depth = 0;
  let cursor = openIdx;
  const len = src.length;
  while (cursor < len) {
    const open = src.indexOf('<Pressable', cursor + 1);
    const close = src.indexOf('</Pressable>', cursor);
    if (close === -1) {
      throw new Error('Bloque Pressable sin cierre </Pressable>');
    }
    if (open !== -1 && open < close) {
      depth += 1;
      cursor = open;
    } else {
      if (depth === 0) {
        return src.slice(openIdx, close + '</Pressable>'.length);
      }
      depth -= 1;
      cursor = close;
    }
  }
  throw new Error('No se encontró el cierre del bloque Pressable country-*');
}

describe('MGC-2131 / PR #482 — country Pressable sin hitSlop (regresión MGC-2081)', () => {
  const countryBlock = extractCountryPressableBlock(IDENTITY_SRC);

  it('Existe exactamente UN Pressable con testID `country-${...}` en identity.tsx', () => {
    const matches = IDENTITY_SRC.match(/testID=\{?`country-\$\{/g) ?? [];
    expect(matches.length, `Se esperaba 1 ocurrencia, halladas ${matches.length}`).toBe(1);
  });

  it('El Pressable de country-* NO define la prop hitSlop', () => {
    // Anti-regresión directa del fix MGC-2081: el `hitSlop` (HIT_SLOP_44)
    // fue la causa raíz. Si alguien lo re-introduce (incluso con otro
    // valor numérico o `hitSlop={8}`), este assert rompe el build.
    expect(countryBlock).not.toMatch(/\bhitSlop\s*[=:]/);
  });

  it('El Pressable de country-* sigue declarando `testID` dinámico (no se rompió el wiring)', () => {
    // Anti-regresión inversa: alguien podría borrar el testID para
    // "evitar el assert". Este assert garantiza que el testID sigue
    // cableado para que el Maestro walk pueda apuntar a `country-ARG`.
    expect(countryBlock).toMatch(/testID=\{?`country-\$\{n\.code === 'AR' \? 'ARG' : n\.code\}`?\}/);
  });

  it('El Pressable de country-* mantiene `onPress` directo (no Pressable wrapper con delayPressIn)', () => {
    // Anti-regresión contra intentos de "arreglar" el bug envolviendo
    // el Pressable en otro wrapper. La solución oficial es la
    // eliminación de hitSlop; cualquier wrapper reintroduce el bug
    // porque vuelve a tener hitSlop efectivo.
    expect(countryBlock).toMatch(/onPress=\{selectNationality\}/);
  });

  it('El Pressable de country-* mantiene `minHeight: 44` (WCAG 2.5.5 sigue cumplido sin hitSlop)', () => {
    // El fix PR #482 explicitó que WCAG 2.5.5 (target 44dp) sigue
    // cumplido vía `minHeight: 44` en style. Si alguien borra ese
    // minHeight junto con el hitSlop, el botón queda < 44dp y rompe
    // accesibilidad. Guardia contra esa combinación.
    expect(countryBlock).toMatch(/minHeight:\s*44/);
  });

  it('El source documenta el fix MGC-2081 con la nota "sin hitSlop"', () => {
    // Anti-regresión documental: el comentario explica POR QUÉ se
    // quitó el hitSlop. Sin él, un futuro reader podría re-introducir
    // el bug confiando en que "WCAG pide hitSlop 44dp" (MGC-1652).
    expect(IDENTITY_SRC).toMatch(/MGC-2081/);
    expect(IDENTITY_SRC).toMatch(/country Pressable SIN hitSlop/);
  });

  it('El comentario MGC-2081 menciona los 3 factores del bug (overflow + hitSlop + ScrollView)', () => {
    // Verifica que la justificación documentada cubre las 3 causas:
    // 1) ScrollView gesture handler, 2) hitSlop expandido, 3) parent
    // overflow:hidden. Si el comentario se trunca, el reader puede
    // reintroducir el bug sin entender la cadena causal.
    // Anclar en el comentario canónico em-dash "MGC-2081 — country Pressable
    // SIN hitSlop" para NO capturar la primera mención one-liner en
    // `causa raíz del bug MGC-2081 hitSlop` (precede `*/}` y no documenta
    // ScrollView). Cortar en próximo `// MGC-NNNN` o fin de comentario.
    const m2081Comment = IDENTITY_SRC.match(
      /MGC-2081\s+—\s+country Pressable SIN hitSlop[\s\S]{0,3000}?(?=\n\s*\/\/\s*MGC-\d{4}|\n\s*\n|\*\/\})/i
    );
    expect(m2081Comment, 'No se encontró bloque comentario MGC-2081').toBeTruthy();
    const text = m2081Comment?.[0] ?? '';
    expect(text).toMatch(/ScrollView/i);
    expect(text).toMatch(/overflow/i);
    expect(text).toMatch(/hitSlop/i);
  });
});