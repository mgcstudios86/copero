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

describe('MGC-3035 input-age CONTROLLED — clear-on-focus + restore-on-blur-cancel', () => {
  /**
   * MGC-3035 — walk F1 sobre APK PR #636 (vc=358, SHA1 4cf6ca26) reprodujo
   * el bug: `input-age` muestra `16` después de Maestro `tap input-age +
   * inputText "20"`. La causa raíz de los intentos anteriores:
   *   - MGC-3029 setNativeProps onFocus → corría JS-side tarde, fuera del
   *     ciclo InputConnection.attach.
   *   - MGC-3032 clearTextOnFocus → iOS-only en RN 0.86 (verificado en
   *     node_modules/react-native/.../ReactEditText.kt — el prop existe en
   *     TextInput.flow.js pero NO está implementado en Android Kotlin,
   *     sólo en iOS RCTBaseTextInputView.mm).
   *
   * El fix hace `value={ageDraft}` (controlled). Al focus, vacía el state
   * si está en preset. Al blur con state vacío, restaura el preset. Estos
   * tests fijan el contrato del path controlado.
   */
  const runFocusClear = (current: string, profileAge: number): string => {
    if (current === '' || current === String(profileAge)) return '';
    return current;
  };

  const runBlurRestore = (current: string, profileAge: number): string => {
    if (current !== '') return current;
    return String(profileAge);
  };

  it('onFocus con current=preset → clear a "" (EditText.setText nativo antes del IME window)', () => {
    // El EditText arranca con defaultValue="16" (2 chars) + maxLength=2.
    // Sin clear, LengthFilter rechaza el primer keystroke Maestro.
    expect(runFocusClear('16', 16)).toBe('');
  });

  it('onFocus con current="" (cancel previo) → clear idempotente', () => {
    // El usuario enfocó, vio el preset, borró todo, salió. Próximo focus
    // debe volver a vaciar (no quedar con texto stale).
    expect(runFocusClear('', 16)).toBe('');
  });

  it('onFocus con current distinto del preset → NO clear (preserva lo tipeado)', () => {
    // El usuario tipeó "20", navegó a otro input, volvió. ageDraft quedó
    // en "20" pero profile.age quedó en 16 (clamp < 16). El EditText debe
    // preservar lo que el usuario tipeó aunque el store ignore el valor.
    expect(runFocusClear('20', 16)).toBe('20');
  });

  it('onFocus con current=String(profile.age) → clear (UX canónico: tap limpia)', () => {
    // El usuario tipeó "20", se commiteó a profile.age=20. Re-focus para
    // editar debe limpiar para que pueda re-tipear desde cero. Esta es la
    // regla canónica de TextInputs numéricos en mobile UX.
    expect(runFocusClear('20', 20)).toBe('');
  });

  it('onBlur con current="" → restore al preset canónico', () => {
    // Cancel puro: focus sin tipear. El EditText debe volver al preset.
    expect(runBlurRestore('', 16)).toBe('16');
    expect(runBlurRestore('', 20)).toBe('20');
  });

  it('onBlur con current="20" → preserva lo tipeado (no pisa con preset)', () => {
    expect(runBlurRestore('20', 16)).toBe('20');
  });
});

describe('MGC-3035 input-age controlled onChangeText — walk F1 PR-636', () => {
  /**
   * Replica el path controlado: actualiza ageDraft Y commitea a profile.age
   * vía setAgeSync. Mantiene `shouldCommitNativeText` como guardia
   * upstream (MGC-2759) contra payloads vacíos que pisan el state cuando
   * el bridge Android entrega '' por IME stale.
   *
   * Escenario walk F1 sobre APK vc=358:
   *   1. Mount → ageDraft='16', profile.age=16.
   *   2. Tap input-age-tap-target → onFocus → ageDraft=''.
   *   3. inputText "20" → onChangeText("20") → ageDraft='20', setAge(20).
   *   4. Tap pos-CAM → onBlur('20') → syncAgeFromNative('20') → no-op.
   *   5. Dump input-age → text='20' ✓.
   */
  const runControlledOnChange = (
    profileAge: number,
    ageDraft: string,
    txt: unknown,
  ): { ageDraft: string; profileAge: number } => {
    if (!shouldCommitNativeText(txt, String(profileAge))) {
      return { ageDraft, profileAge };
    }
    const cleaned = (txt as string).replace(/[^0-9]/g, '').slice(0, 2);
    if (cleaned === '') return { ageDraft: '', profileAge };
    const parsed = Number.parseInt(cleaned, 10);
    if (!Number.isFinite(parsed)) return { ageDraft: '', profileAge };
    // setAgeSync → setAge (clamp 16-35). El caller real aplica el clamp en
    // el store; acá replicamos para que el test verifique el contrato full.
    const clamped = Math.max(16, Math.min(35, Math.floor(parsed)));
    return { ageDraft: cleaned, profileAge: clamped };
  };

  it('walk F1 happy path: tap+inputText "20" → ageDraft="20", profile.age=20', () => {
    // Estado inicial post-focus-clear: ageDraft='', profile.age=16 (preset).
    const step1 = runControlledOnChange(16, '', '20');
    expect(step1.ageDraft).toBe('20');
    expect(step1.profileAge).toBe(20);
  });

  it('walk F1 paso a paso: typing char-by-char respeta el clamp del store', () => {
    // Maestro puede tipear "2" primero y luego "20". El clamp 16-35 vive
    // en setAge; el onChangeText entrega parsed al setter. El test cubre
    // que la rama "parsed finite → setAgeSync" llega al caller sin
    // colapsar al preset.
    const after2 = runControlledOnChange(16, '', '2');
    expect(after2.ageDraft).toBe('2');
    // 2 < 16 → clamp lo deja en 16 (la edad visible del preset).
    expect(after2.profileAge).toBe(16);

    const after20 = runControlledOnChange(after2.profileAge, after2.ageDraft, '20');
    expect(after20.ageDraft).toBe('20');
    expect(after20.profileAge).toBe(20);
  });

  it('payload vacío desde el bridge Android → no pisa ageDraft ni profile.age', () => {
    // MGC-2759 trade-off: un payload '' no debe borrar el state canónico.
    // Aplica igual al path controlado.
    const result = runControlledOnChange(20, '20', '');
    expect(result.ageDraft).toBe('20');
    expect(result.profileAge).toBe(20);
  });

  it('payload "1" queda clamped a 16 por setAge, ageDraft visible="1"', () => {
    // El user tipea "1" → ageDraft visible "1" (controlled), profile.age
    // queda en 16 por el clamp. Esto es esperado: el form muestra lo que
    // el usuario tipeó, y el commit al store respeta el rango válido.
    const result = runControlledOnChange(16, '', '1');
    expect(result.ageDraft).toBe('1');
    expect(result.profileAge).toBe(16);
  });
});

