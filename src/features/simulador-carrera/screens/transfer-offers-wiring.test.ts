import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * MGC-1803 — TR1: wire UX fin-temporada.
 *
 * Verifica el cableado entre `temporada.tsx` y la nueva pantalla de
 * ofertas:
 *  - Tras `advanceSeason`, si el motor dejó un `transferState` con
 *    ofertas, redirige a `/simulador-carrera/transfer-offers`.
 *  - El guard es idempotente: NO re-dispara cuando `resolved === true`.
 *  - No se renderiza en retirement (eso lo cubre el wire existente a
 *    `/fin-carrera`).
 *
 * Complementa `transfer-offers.test.ts` (estructura) y
 * `fase3-events-transfers.test.ts` (motor puro).
 */
describe('temporada → transfer-offers wire (MGC-1803 TR1)', () => {
  const src = readFileSync(
    resolve(__dirname, 'temporada.tsx'),
    'utf8',
  );

  it('lee transferState del store', () => {
    expect(src).toContain('transferState = useCareerStore((s) => s.transferState)');
  });

  it('declara useEffect de redirección cuando hay ofertas sin resolver', () => {
    // Verifica el patrón canónico del wire: lee el estado, monta el
    // redirect cuando `!resolved && offers.length > 0`.
    expect(src).toContain("router.replace('/simulador-carrera/transfer-offers')");
  });

  it('guarda contra re-disparo (idempotencia)', () => {
    // El useEffect debe chequear `!transferState.resolved` — sin esto,
    // volver al hub re-abre la pantalla de ofertas en loop.
    expect(src).toMatch(/transferState\s*&&\s*!transferState\.resolved/);
    expect(src).toMatch(/transferState\.offers\.length\s*>\s*0/);
  });

  it('no pisa el wire de retirement (MGC-209 fin-carrera)', () => {
    // El useEffect original de retirement (`router.replace('/fin-carrera')`)
    // sigue presente — son dos redirects distintos, uno por stage, otro
    // por transferState.
    expect(src).toContain("router.replace('/simulador-carrera/fin-carrera')");
    expect(src).toContain("if (stage === 'retirement')");
  });

  it('declara el file-based route wrapper', () => {
    const routePath = resolve(
      __dirname,
      '../../../../app/simulador-carrera/transfer-offers.tsx',
    );
    const routeSrc = readFileSync(routePath, 'utf8');
    expect(routeSrc).toContain('TransferOffersRoute');
    expect(routeSrc).toContain(
      "import('@/features/simulador-carrera/screens/transfer-offers')",
    );
  });
});
