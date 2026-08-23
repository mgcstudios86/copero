/**
 * Wrapper de storage multiplataforma para el Ideología Futbolística.
 *
 * - Web (Expo web + react-native-web): usa `localStorage` del navegador.
 * - Nativo (iOS / Android): usa `@react-native-async-storage/async-storage`.
 *
 * API mínima: `getItem`, `setItem`, `removeItem`. Devuelve `Promise` siempre
 * para mantener una firma consistente entre plataformas.
 *
 * Esta capa es independiente del wrapper usado por `shared/store/storage.ts`
 * (que tiene la interfaz `StateStorage` de Zustand): la usamos cuando queremos
 * manipular strings arbitrarios desde el quiz sin meternos en `zustand/middleware`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const STORAGE_NAMESPACE = 'copero:ideologia:v1' as const;

export type CompassStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const webImpl: CompassStorage = {
  getItem(key) {
    if (typeof window === 'undefined') return Promise.resolve(null);
    return Promise.resolve(window.localStorage.getItem(key));
  },
  setItem(key, value) {
    if (typeof window === 'undefined') return Promise.resolve();
    window.localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem(key) {
    if (typeof window === 'undefined') return Promise.resolve();
    window.localStorage.removeItem(key);
    return Promise.resolve();
  },
};

const nativeImpl: CompassStorage = {
  async getItem(key) {
    return AsyncStorage.getItem(key);
  },
  async setItem(key, value) {
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key) {
    await AsyncStorage.removeItem(key);
  },
};

export const storage: CompassStorage =
  Platform.OS === 'web' ? webImpl : nativeImpl;

/** Prefijo de claves del quiz. Mantener estable entre versiones. */
export function key(name: string): string {
  return `${STORAGE_NAMESPACE}:${name}`;
}