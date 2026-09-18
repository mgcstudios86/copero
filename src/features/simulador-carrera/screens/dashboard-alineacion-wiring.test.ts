import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * MGC-245 — dashboard CTA debe navegar a `/alineacion`, NO directo a
 * `/match`. Antes (MGC-1650) el branch post-club llamaba startMatch()
 * y empujaba a /match → auto-play sin selección (AC3 MGC-240 fail).
 *
 * Este guard estructural cierra el bug: si alguien revierte el
 * flow, este test rompe antes del merge.
 */
describe('dashboard — CTA post-club va a /alineacion (MGC-245)', () => {
  const src = readFileSync(
    resolve(__dirname, 'dashboard.tsx'),
    'utf8',
  );

  it('el handler onAcademyPress navega a /alineacion cuando hay club', () => {
    // Busca el bloque del handler post-club. Regex flexible para
    // tolerar whitespace y comentarios alrededor.
    const pushMatchIdx = src.indexOf(
      "router.push('/simulador-carrera/match')",
    );
    const pushAlignIdx = src.indexOf(
      "router.push('/simulador-carrera/alineacion')",
    );
    expect(pushMatchIdx).toBe(-1); // removido por MGC-245
    expect(pushAlignIdx).toBeGreaterThan(-1);
  });

  it('no queda destructure huérfano de startMatch', () => {
    expect(src).not.toMatch(/const startMatch = useCareerStore\(\(s\) => s\.startMatch\)/);
  });
});