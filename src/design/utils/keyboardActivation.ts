// src/design/utils/keyboardActivation.ts — Copero (MGC-461)
//
// Helper de a11y para que Pressable/disparadores respondan a teclado en web.
// react-native-web renderiza Pressable como un host element focusable pero
// NO dispara onPress cuando se presiona Enter o Space — sólo en click (mouse).
// Para que la spec e2e/a11y-keyboard.spec.ts pase "Tab + Enter sin mouse",
// agregamos un onKeyDown que dispara el callback en Enter/Space.
//
// MGC-822: axe-core valida 0 violations en home/identity/dashboard web, así
// que el helper NO interfiere con aria-required-attr, aria-selected, etc.
//
// Nota: `Pressable` de react-native NO tipa `onKeyDown` (es prop web-only).
// El helper expone un `Props` shape compatible con un spread seguro sobre
// Pressable sin generar TS2322.

export type KeyboardActivationProps = {
  /** MGC-461: handler web que activa el callback en Enter o Space. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onKeyDown?: any;
};

/**
 * Devuelve un handler `onKeyDown` que activa el callback cuando se presiona
 * Enter o Space — WCAG 2.1.1 (Keyboard) + patrón aria-keyshortcuts.
 *
 * Uso:
 *   const kbd = onKeyActivate(onPress);
 *   <Pressable onPress={onPress} {...kbd} />
 */
export function onKeyActivate(activate: () => void): KeyboardActivationProps {
  return {
    onKeyDown: (event: { key?: string; preventDefault?: () => void }): void => {
      const key = event?.key;
      if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
        event?.preventDefault?.();
        activate();
      }
    },
  };
}
