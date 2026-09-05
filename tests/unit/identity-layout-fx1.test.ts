/**
 * FX1-B2 / MGC-1739 — Regresión layout /identity.
 *
 * Catálogo P0-2 (field-map recortado, pos-RW/RB fuera de viewport) y
 * P0-3 (title "Define tu identidad" truncado) reproducidos sobre APK
 * build-PR-420 vc=109. Esos items son stale sobre el main actual
 * c1d8eb5 (PR-440 MGC-1737 + PR-427 MGC-1628 WF1):
 *
 *   - field-map se reemplazó por chips GK/CB/CAM/ST (PR-427 §L4) con
 *     un único row de 4 Pressables, `flex: 1` + `hitSlop: 8`, total
 *     height ≈ 96dp con paddingTop/Bottom spacing[3] — entra en
 *     viewport 732.8dp sin recortes.
 *   - title actual ES "Creá tu jugador" (17 chars). El catálogo
 *     documentaba "Define tu identidad" (19 chars) — string viejo de
 *     pre-WF1. La traducción en-US actual "Create your player" mide
 *     ~270px a 30px Poppins bold, viewport 1080px ⇒ sobra 810px.
 *
 * Estos tests son guardias de regresión contra futuros cambios que
 * reintroduzcan el problema:
 *
 *   1. identity.title / eyebrow / subtitle existen en es / en / zh-CN
 *      con la longitud que cabe en una línea a 30px bold.
 *   2. El archivo identity.tsx contiene los testIDs de los 4 chips
 *      pos-GK / pos-CB / pos-CAM / pos-ST (regresión P0-2).
 *   3. El componente <Text> del title lleva los props defensivos
 *      `numberOfLines={1}` + `adjustsFontSizeToFit` (anti-truncado).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COPY } from '../../src/i18n/copy';

type IdentityCopy = { title: string; eyebrow: string; subtitle: string };

function pickIdentity(loc: 'es' | 'en' | 'zh-CN'): IdentityCopy {
  const seg = (COPY[loc] as unknown as { identity: IdentityCopy }).identity;
  return seg;
}

describe('FX1-B2 / MGC-1739 regresión /identity layout', () => {
  const identityES = pickIdentity('es');
  const identityEN = pickIdentity('en');
  const identityZH = pickIdentity('zh-CN');

  it('identity.eyebrow existe en los 3 locales (es/en/zh-CN)', () => {
    expect(identityES.eyebrow.length).toBeGreaterThan(0);
    expect(identityEN.eyebrow.length).toBeGreaterThan(0);
    expect(identityZH.eyebrow.length).toBeGreaterThan(0);
  });

  it('identity.title cabe en una línea a 30px bold (≤30 chars ES/EN, ≤12 zh-CN)', () => {
    // 30 chars ES/EN es límite empírico a fontSize['2xl']=30 con Poppins
    // bold en viewport 1080px — `adjustsFontSizeToFit` cubre overflow pero
    // queremos que el copy no dependa del auto-shrink en condiciones
    // nominales. CJK es más ancho por char ⇒ límite 12.
    expect(identityES.title.length).toBeLessThanOrEqual(30);
    expect(identityEN.title.length).toBeLessThanOrEqual(30);
    expect(identityZH.title.length).toBeLessThanOrEqual(12);
  });

  it('identity.subtitle cabe en dos líneas (≤80 chars ES/EN, ≤30 zh-CN)', () => {
    expect(identityES.subtitle.length).toBeLessThanOrEqual(80);
    expect(identityEN.subtitle.length).toBeLessThanOrEqual(80);
    expect(identityZH.subtitle.length).toBeLessThanOrEqual(30);
  });

  it('identity.tsx expone los 4 chips pos-GK/pos-CB/pos-CAM/pos-ST (regresión P0-2)', () => {
    // El catálogo MGC-1739 (PR-420 vc=109) reportó pos-RW/pos-RB
    // clippeados porque el field-map viejo tenía 12+ Pressables en una
    // grilla. PR-427 MGC-1628 WF1 reemplazó esa grilla por 4 chips
    // representantes. Esta guardia rompe el build si alguien re-introduce
    // un field-map completo o elimina los testIDs contrato.
    const src = readFileSync(
      resolve(__dirname, '../../src/features/simulador-carrera/screens/identity.tsx'),
      'utf8',
    );
    expect(src).toMatch(/testID=\{?`pos-\$\{chip\.id\}`?\}?/);
    expect(src).toMatch(/pos-GK/);
    expect(src).toMatch(/pos-CB/);
    expect(src).toMatch(/pos-CAM/);
    expect(src).toMatch(/pos-ST/);
    // Belt-and-suspenders: ningún pos-RW/pos-RB/pos-LB reintroducido en
    // la grilla de chips (esos viven SOLO en el árbol semanal F2).
    expect(src).not.toMatch(/testID=\{?`pos-RW`?\}?/);
    expect(src).not.toMatch(/testID=\{?`pos-RB`?\}?/);
  });

  it('identity.tsx aplica numberOfLines + adjustsFontSizeToFit al <Text> del title (anti P0-3)', () => {
    // El catálogo documentó "Define tu identidad" → "Define tu identida[d]"
    // en build-PR-420. El copy actual cabe, pero blindamos el componente
    // para que NUNCA truncate ni crezca verticalmente (eso desplazaría
    // nationality-section + input-name).
    const src = readFileSync(
      resolve(__dirname, '../../src/features/simulador-carrera/screens/identity.tsx'),
      'utf8',
    );
    expect(src).toMatch(/numberOfLines=\{1\}/);
    expect(src).toMatch(/adjustsFontSizeToFit/);
    expect(src).toMatch(/minimumFontScale=\{0\.7\}/);
  });

  it('MGC-1874 — nationality-section cap ≤3 filas + minHeight ≤44dp para no tapar el form', () => {
    // El walk WF1 PR #440 reveló que el form /identity quedaba COMPLETO
    // debajo del sticky-footer: input-name bounds=[10,1989][1070,2089],
    // input-lastname height=-4 (clipeado al bottom del viewport), input-age
    // y btn-foot-{izq,der,ambos} AUSENTES del dump fresh-mount. Causa raíz:
    // cap=5 + minHeight=56dp + paddingV=12dp consumían ≈793px del
    // viewport, dejando al form sin espacio arriba del footer top y=1530.
    //
    // Guardia de regresión: cap declarado a 3 y minHeight de fila a 44dp
    // (con paddingV spacing[2]=8dp) deja el form 100% visible sin scroll.
    // country-ARG/BR/UY siguen visibles en fresh-mount (AC1 MGC-1737).
    // country-CL/CO siguen accesibles vía search o "Ver todas (N)".
    const src = readFileSync(
      resolve(__dirname, '../../src/features/simulador-carrera/screens/identity.tsx'),
      'utf8',
    );
    // cap declarado explícitamente (evita magia + comentarios).
    const capMatch = src.match(/const NATIONALITY_FRESH_LIMIT = (\d+);/);
    expect(capMatch).not.toBeNull();
    const cap = Number.parseInt(capMatch![1], 10);
    expect(cap).toBeGreaterThanOrEqual(1);
    expect(cap).toBeLessThanOrEqual(3);

    // minHeight de la fila country-* ≤44dp (era 56dp antes de MGC-1874).
    expect(src).toMatch(/minHeight:\s*4[34],?/);
  });

  it('MGC-1874 — form inputs (input-name/lastname/age) usan paddingVertical spacing[1] para compactar', () => {
    // spacing[2]=8dp × 4 inputs = 32dp liberados → form pasa de 620px a
    // ~540px, entrando arriba del sticky-footer top y=1530 en ZY22G728HN.
    // Combinado con cap=3 y minHeight=44dp libera el espacio completo.
    const src = readFileSync(
      resolve(__dirname, '../../src/features/simulador-carrera/screens/identity.tsx'),
      'utf8',
    );
    // El bloque de style de los TextInputs del form llevan spacing[1].
    const inputStyleBlocks = src.match(/styles\.input,[\s\S]{0,800}?paddingVertical:\s*spacing\[1\]/g);
    expect(inputStyleBlocks).not.toBeNull();
    expect(inputStyleBlocks!.length).toBeGreaterThanOrEqual(3); // name + lastname + age
  });
});
