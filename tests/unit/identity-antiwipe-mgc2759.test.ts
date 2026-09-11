/**
 * MGC-2759 — regresión del wipe de `input-name` / `input-lastname`.
 *
 * Historia: release-4 vc=303 (PR #594 squash 8ff117e, SHA1 cd0880a5) rompe
 * el identity form. Tras un focus shift o un BACK (blur), los EditText
 * quedan VACÍOS y `btn-identity-continue` queda disabled (walk MGC-2732
 * F2b FAIL). El walk MGC-2735 sobre vc=304 reprodujo el mismo wipe por
 * otro path: tapear `country-ARG` borra NOMBRE y APELLIDO.
 *
 * Los dos paths entregan un payload VACÍO desde el bridge nativo:
 *   1. `onBlur` → `e.nativeEvent.text` es `undefined` cuando el texto se
 *      inyectó vía `adb shell input text` / Maestro `inputText`.
 *   2. `onChangeText('')` → el IME bridge de RN-Android lo dispatcha al
 *      perder `mServedView` cuando el foco se mueve a un Pressable.
 *
 * `shouldCommitNativeText` es la guardia pura compartida por ambos paths.
 * Estos tests fijan su contrato para que ningún refactor futuro reintroduzca
 * el wipe.
 *
 * Refs: MGC-2733 (padre), MGC-2732 / MGC-2735 (walks), MGC-2673 (safety net
 * onBlur origen), PR #594 (cherry-pick que introdujo la regresión).
 */
import { describe, expect, it } from 'vitest';

import { shouldCommitNativeText } from '@/features/career/identity-state';

describe('MGC-2759 shouldCommitNativeText — guardia anti-wipe', () => {
  it('descarta el payload vacío cuando el state canónico tiene contenido', () => {
    // Este es EL caso de la regresión: el EditText muestra 'Q' pero el
    // bridge entrega ''. Commitear borraría lo tipeado.
    expect(shouldCommitNativeText('', 'Q')).toBe(false);
    expect(shouldCommitNativeText('', 'Quilmes')).toBe(false);
  });

  it('descarta undefined / null / no-string (onBlur sin campo `text`)', () => {
    // `e.nativeEvent.text` llega undefined en build release; sin el `?? ''`
    // de la llamada, el valor crudo también debe descartarse.
    expect(shouldCommitNativeText(undefined, 'Q')).toBe(false);
    expect(shouldCommitNativeText(null, 'Q')).toBe(false);
    expect(shouldCommitNativeText(undefined, '')).toBe(false);
    expect(shouldCommitNativeText(42, 'Q')).toBe(false);
    expect(shouldCommitNativeText({}, 'Q')).toBe(false);
  });

  it('propaga cualquier payload no vacío (caso feliz: el usuario tipea)', () => {
    expect(shouldCommitNativeText('Q', '')).toBe(true);
    expect(shouldCommitNativeText('Quilmes', 'Q')).toBe(true);
    // Idempotente: mismo texto que el state sigue siendo commiteable; el
    // caller compara `text !== current` antes de escribir.
    expect(shouldCommitNativeText('Q', 'Q')).toBe(true);
    // Espacios cuentan como contenido: no es tarea de la guardia trimear.
    expect(shouldCommitNativeText(' ', 'Q')).toBe(true);
  });

  it('permite borrar cuando el state ya está vacío (no rompe el reset manual)', () => {
    // El usuario borra todo con backspace: el state ya quedó en '' por los
    // onChangeText intermedios, así que el '' final debe propagar.
    expect(shouldCommitNativeText('', '')).toBe(true);
    expect(shouldCommitNativeText('', null)).toBe(true);
    expect(shouldCommitNativeText('', undefined)).toBe(true);
  });

  it('cubre el wipe de APELLIDO donde el state canónico es null', () => {
    // `profile.lastName` es `string | null`; el path onChangeText lee el
    // valor crudo (sin `?? ''`). Con lastName ya seteado, '' no borra.
    expect(shouldCommitNativeText('', 'Perez')).toBe(false);
    expect(shouldCommitNativeText('Perez', null)).toBe(true);
  });
});

describe('MGC-2759 secuencia del walk MGC-2735 (country-ARG tap)', () => {
  /** Simula el store: commitea sólo si la guardia lo autoriza. */
  const runSequence = (initial: string, payloads: unknown[]): string => {
    let state = initial;
    for (const p of payloads) {
      if (shouldCommitNativeText(p, state)) state = p as string;
    }
    return state;
  };

  it('preserva NOMBRE tras onChangeText("") + onBlur(undefined)', () => {
    // Secuencia real: tipeo 'Q' → tap country-ARG → IME dispatcha ''
    // → blur sin `text`. Antes del fix el resultado era ''.
    expect(runSequence('', ['Q', '', undefined])).toBe('Q');
  });

  it('preserva NOMBRE completo tras focus shift a input-lastname', () => {
    // Walk MGC-2732 F2b: 'Q' en name, foco a lastname, BACK.
    expect(runSequence('', ['Q', undefined, '', undefined])).toBe('Q');
  });

  it('trade-off aceptado: el backspace NO puede dejar el campo en vacío total', () => {
    // Backspace char a char: 'Qu' → 'Q' → ''. Cuando llega el '' el state
    // canónico todavía es 'Q', así que la guardia lo bloquea. No podemos
    // distinguir ese '' del que dispatcha el IME bridge al perder foco
    // (walk MGC-2735 usa un nombre de UN caracter, así que una heurística
    // por longitud tampoco separa los casos).
    //
    // Costo aceptado: el usuario llega hasta 1 caracter y reemplaza
    // seleccionando + tipeando. `isIdentityComplete` exige nombre no vacío,
    // así que "campo totalmente vacío" nunca es un estado final válido.
    // Este test existe para que el trade-off sea explícito, no accidental.
    expect(runSequence('', ['Qu', 'Q', ''])).toBe('Q');
  });
});

describe('MGC-2940 input-age onChangeText — guardia anti-wipe simétrica con setNameSync', () => {
  /**
   * Replica el path `onChangeText` de `input-age` (identity.tsx:1164) tras
   * el fix: la guarda `shouldCommitNativeText` corre ANTES del parse +
   * setAge. Si la guardia rechaza, NO se commitea la edad. Si acepta, se
   * aplica la transformación cleaned → parsed tal cual el código real.
   *
   * El walk MGC-2937 sobre APK vc=320 (PR #600 1357ea4) reportó
   * `input-age.text = 16` tras tipear 20. Ese APK precede a PR #601
   * (MGC-2759 vc=325), PR #604 (MGC-2764 vc=324) y MGC-2765 (vc=322),
   * así que la evidencia original no es concluyente para `main`. Este
   * test fija el contrato del path `onChangeText` sobre el código actual
   * (donde `input-age` era el único TextInput de identity sin la guarda).
   */
  const runOnChangeAge = (initial: number, txt: unknown): number => {
    if (!shouldCommitNativeText(txt, String(initial))) return initial;
    const cleaned = (txt as string).replace(/[^0-9]/g, '').slice(0, 2);
    return cleaned === '' ? 16 : Number.parseInt(cleaned, 10);
  };

  it('payload vacío sobre edad=20 NO resetea a 16 (regresión walk MGC-2937)', () => {
    // Antes del fix: cleaned='' → parsed=16 → setAge(16) pisaba la edad
    // tipeada por el usuario. Después del fix:
    //   shouldCommitNativeText('', '20') === false  → early-return.
    expect(runOnChangeAge(20, '')).toBe(20);
  });

  it('payload no-string sobre edad=20 NO resetea a 16', () => {
    // Mismo modo de fallo que MGC-2759 sobre build release con
    // `adb shell input text` / Maestro `inputText`: el bridge entrega
    // `undefined` / `null` / un valor primitivo no esperado.
    expect(runOnChangeAge(20, undefined)).toBe(20);
    expect(runOnChangeAge(20, null)).toBe(20);
    expect(runOnChangeAge(20, 42)).toBe(20);
  });

  it("payload '20' sobre edad=16 SI commitea (caso feliz: el usuario tipea)", () => {
    // Estado inicial del form: edad = preset (16). El usuario tipea '20'.
    expect(runOnChangeAge(16, '20')).toBe(20);
  });

  it("payload '20' sobre edad=20 es idempotente (mismo valor, no resetea)", () => {
    // El caller (setAgeSync) compara `parsed !== current` antes de escribir;
    // aquí sólo verificamos que la guardia deja pasar el payload.
    expect(runOnChangeAge(20, '20')).toBe(20);
  });

  it("re-tipeo parcial '2' sobre edad=20 SI commitea (parsed=2, clamp final en setAge)", () => {
    // El clamp 16-35 vive dentro de `setAge` en el store; este test sólo
    // cubre el path del componente. La pre-condición de la guardia
    // ('2' es string no vacío) se cumple y el parsed llega al setter.
    expect(runOnChangeAge(20, '2')).toBe(2);
  });
});

// MGC-2973 — retrigger CI tras cancelaciones purge-stale-runs (MGC-2909 fix ya merged PR #615/#616).
// Sin cambio funcional: comment-only para forzar pull_request event fresco sobre runners healthy.

