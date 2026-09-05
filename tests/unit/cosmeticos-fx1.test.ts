/**
 * FX1-B5 / MGC-1739 — Regresión cosméticos P1.
 *
 * Catálogo priorizó:
 *   P1-1 Camiseta muestra bandera país en vez de colores club (asset).
 *   P1-2 Title 'identity' del header (parcialmente cubierto por B1 footer dup).
 *   P1-3 Crests texto placeholder (asset — fuera de scope mobile).
 *   P1-4 Typo 'MAGNETO-MEDIATICO' (decisión de branding, no se renombra).
 *   P1-5 Stats row EDAD/CLUB/OVR/P/G/A clippeada (verificamos a11y header).
 *   P1-6 Labels OP/OG/OA sin a11y (header timeline dashboard ahora con
 *        accessibilityLabel expandido).
 *   P1-8 CTA 'Siguiente semana (2/38)' paréntesis raro (cambiado a
 *        middot · que es la convención del producto).
 *
 * P1-1, P1-3 y P1-4 son decisiones de diseño / branding que requieren
 * input del equipo de arte o del product owner. Documentados como
 * follow-up. P1-2 se cerró parcialmente en B1 (footer VersionLabel dup).
 *
 * Items activos en este PR:
 *   - P1-8 temporada.tsx Button label usa middot · en vez de ().
 *   - P1-6 dashboard.tsx timeline header tiene accessibilityLabel
 *     expandido y accessibilityRole="header" para TalkBack.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('FX1-B5 / MGC-1739 regresión cosméticos P1', () => {
  const temporadaSrc = readFileSync(
    resolve(
      __dirname,
      '../../src/features/simulador-carrera/screens/temporada.tsx',
    ),
    'utf8',
  );
  const dashboardSrc = readFileSync(
    resolve(
      __dirname,
      '../../src/features/simulador-carrera/screens/dashboard.tsx',
    ),
    'utf8',
  );

  describe('P1-8 paréntesis raro en CTA Siguiente semana', () => {
    it('label usa middot · en vez de paréntesis ()', () => {
      // El catálogo marcó "Siguiente semana (2/38)" como paréntesis raro
      // en español. La convención del producto es middot · (ver
      // semanal.tsx:87 `SEMANA {week}/38 · {position}`).
      expect(temporadaSrc).toMatch(
        /label=\{`Siguiente semana · \$\{profile\.week\}\/38`\}/,
      );
      // Belt: ningún otro Button del footer mantiene el patrón viejo.
      expect(temporadaSrc).not.toMatch(
        /label=\{`[^`]*\(\$\{profile\.week\}\/38\)`\}/,
      );
    });
  });

  describe('P1-6 a11y timeline header dashboard', () => {
    it('header del timeline tiene accessibilityRole="header"', () => {
      expect(dashboardSrc).toMatch(
        /backgroundColor: colors\.surface2[\s\S]{0,400}accessibilityRole="header"/,
      );
    });

    it('cada columna del header tiene accessibilityLabel expandido', () => {
      // WCAG 2.5.5 + WCAG 4.1.2 — textos crípticos (OVR, APPS, G, AST)
      // deben tener label semántico para TalkBack/VoiceOver.
      expect(dashboardSrc).toMatch(/accessibilityLabel="Edad"/);
      expect(dashboardSrc).toMatch(/accessibilityLabel="Club"/);
      expect(dashboardSrc).toMatch(/accessibilityLabel="Overall"/);
      expect(dashboardSrc).toMatch(/accessibilityLabel="Partidos jugados"/);
      expect(dashboardSrc).toMatch(/accessibilityLabel="Goles"/);
      expect(dashboardSrc).toMatch(/accessibilityLabel="Asistencias"/);
    });
  });

  describe('items documentados como follow-up (no activos en B5)', () => {
    it('P1-1 camiseta bandera vs club: queda para asset/arte (no .tsx fix)', () => {
      // El render del jersey usa countryCode → flag SVG. Para mostrar
      // colores del club se necesita un asset de jersey por clubId o un
      // cambio de diseño. No se aborda en este PR.
      const jerseyPreview = readFileSync(
        resolve(__dirname, '../../src/design/components/JerseyPreview.tsx'),
        'utf8',
      );
      expect(jerseyPreview).toMatch(/countryCode/);
    });

    it('P1-4 typo Magnate mediático: branding intencional (magneto-mediatico)', () => {
      // El comentario en types/career.ts:180 documenta "Magneto mediático"
      // como decisión de branding. No se renombra el enum para no romper
      // saves persistidos. Si el product owner decide cambiar, será un
      // PR con migración.
      const typesSrc = readFileSync(
        resolve(__dirname, '../../src/types/career.ts'),
        'utf8',
      );
      expect(typesSrc).toMatch(/'magneto-mediatico' \| 'trotamundos'/);
    });
  });
});
