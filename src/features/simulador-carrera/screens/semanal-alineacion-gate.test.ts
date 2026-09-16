import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * MGC-261 — el handler `onPick` de semanal con `doble_turno` debe
 * navegar a `/alineacion`, NO directo a `/match`. Antes (PR #16) este
 * handler llamaba `startMatch()` y empujaba a /match → el usuario
 * saltaba la decisión táctica pre-partido (regression MGC-245 AC3:
 * el flujo partido debe pasar por /alineacion obligatoriamente).
 *
 * El dashboard ya tenía este guard (`dashboard-alineacion-wiring.test.ts`),
 * pero la cadena weekly → /match que arranca en season-hub "Decidir semana"
 * → semanal → doble_turno seguía bypaseando /alineacion. Este guard
 * estructural cierra ese branch para que el bug no vuelva.
 */
describe('semanal — doble_turno navega a /alineacion (MGC-261)', () => {
  const src = readFileSync(
    resolve(__dirname, 'semanal.tsx'),
    'utf8',
  );

  it('el bloque doble_turno no navega directo a /match', () => {
    // El bug del PR #16 era esta llamada. La cadena correcta va:
    // semanal doble_turno → /alineacion (gate obligatorio) → /match.
    const pushMatchIdx = src.indexOf(
      "router.push('/simulador-carrera/match')",
    );
    expect(pushMatchIdx).toBe(-1);
  });

  it('el bloque doble_turno navega a /alineacion', () => {
    const pushAlignIdx = src.indexOf(
      "router.push('/simulador-carrera/alineacion')",
    );
    expect(pushAlignIdx).toBeGreaterThan(-1);
  });

  it('no queda destructure huérfano de startMatch (lo dispara /alineacion)', () => {
    // MGC-261 — semanal ya no dispara startMatch; lo hace /alineacion
    // desde su onConfirm. Si alguien restaura startMatch en semanal,
    // el flow se rompe (startMatch correría dos veces).
    expect(src).not.toMatch(
      /const startMatch = useCareerStore\(\(s\) => s\.startMatch\)/,
    );
  });
});