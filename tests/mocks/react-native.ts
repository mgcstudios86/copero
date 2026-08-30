/**
 * Mock mínimo de `react-native` para vitest (MGC-363).
 *
 * Vitest SSR transform rompe al cruzar `react-native/index.js` porque
 * el entry expone Flow types que el parser no soporta (error
 * "Expected 'from', got 'typeOf'" en `ssrTransformScript`).
 *
 * Expone solo lo que el código bajo test consume:
 *  - `AppState`: shape nativo con `currentState` y `addEventListener`.
 *  - `Platform.OS`: discrimina web vs native en storage adapter.
 *  - `View`, `StyleSheet`, `Text`, etc.: shapes vacíos para casos
 *    donde el store/component los importa por type. Como vitest
 *    corre en node sin React render, estos shapes no se usan.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyListener = (...args: any[]) => void;

export const AppState = {
  currentState: 'active' as string | null,
  _listeners: new Set<AnyListener>(),
  addEventListener(_event: string, listener: AnyListener) {
    this._listeners.add(listener);
    return {
      remove: () => {
        this._listeners.delete(listener);
      },
    };
  },
  removeEventListener(_event: string, listener: AnyListener) {
    this._listeners.delete(listener);
  },
  emit(next: string) {
    for (const fn of this._listeners) fn(next);
  },
};

export const Platform = {
  OS: 'ios' as 'ios' | 'android' | 'web' | 'macos' | 'windows',
  select<T>(spec: Partial<Record<'ios' | 'android' | 'web' | 'macos' | 'windows', T>> & { default?: T }): T | undefined {
    return (spec as Partial<Record<string, T>>)[this.OS] ?? spec.default;
  },
};

export const View = function View() {
  return null;
};
export const Text = function Text() {
  return null;
};
export const StyleSheet = {
  create<T>(styles: T): T {
    return styles;
  },
  flatten(style: unknown) {
    return style;
  },
  hairlineWidth: 1,
};

export const Pressable = function Pressable() {
  return null;
};
export const ScrollView = function ScrollView() {
  return null;
};
export const TextInput = function TextInput() {
  return null;
};
export const AccessibilityInfo = {
  announceForAccessibility: () => undefined,
};