/**
 * i18n onboarding gate — MGC-491.
 *
 * Persistencia del flag "el usuario ya pasó por el selector de idioma".
 * Separado de `copero:locale` (la elección de idioma en sí) para que:
 *
 * 1. Reset de app (clear AsyncStorage) → usuario ve onboarding de nuevo.
 * 2. Cambio de locale via LanguageSwitcher (chip del header) NO marca
 *    `onboarded=true` — el usuario todavía no pasó por la pantalla
 *    dedicada y podría no saber que existen otros idiomas.
 * 3. Onboarding completado persiste aunque después cambie el locale.
 *
 * Storage keys:
 * - `copero:locale` (locale activo) — manejado por `locale-context.tsx`.
 * - `copero:locale:onboarded` ("1" = ya vio el onboarding) — este módulo.
 *
 * Web vs nativo: AsyncStorage nativo, localStorage en web. Misma clave.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const ONBOARDED_STORAGE_KEY = 'copero:locale:onboarded';

function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function loadOnboardedFlag(): Promise<boolean> {
  try {
    const web = getWebStorage();
    if (web) {
      return web.getItem(ONBOARDED_STORAGE_KEY) === '1';
    }
    const raw = await AsyncStorage.getItem(ONBOARDED_STORAGE_KEY);
    return raw === '1';
  } catch {
    return false;
  }
}

export async function markOnboarded(): Promise<void> {
  try {
    const web = getWebStorage();
    if (web) {
      web.setItem(ONBOARDED_STORAGE_KEY, '1');
      return;
    }
    await AsyncStorage.setItem(ONBOARDED_STORAGE_KEY, '1');
  } catch {
    // best-effort
  }
}

export async function resetOnboardedFlag(): Promise<void> {
  try {
    const web = getWebStorage();
    if (web) {
      web.removeItem(ONBOARDED_STORAGE_KEY);
      return;
    }
    await AsyncStorage.removeItem(ONBOARDED_STORAGE_KEY);
  } catch {
    // best-effort
  }
}
