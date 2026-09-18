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

/**
 * MGC-215 — barrido exhaustivo de storage para "Nueva partida".
 *
 * Limpia TODAS las keys conocidas de Copero (no sólo la partida
 * guardada) para que el state post-restart sea idéntico al de primera
 * instalación. Caso de uso: el usuario llegó al fin de carrera y desde
 * `fin-carrera.tsx` tap "Nueva partida". Sin este barrido, las keys de
 * `copero-game-stats` (highScore/bestStreak) y `copero:ideologia:v1:*`
 * (progreso del quiz) sobreviven — el siguiente onboarding las
 * re-hidrataría con data fantasma de la partida anterior.
 *
 * Alcance:
 *   - namespace `copero:` (carrera, quiz, cualquier feature futuro)
 *   - prefix legacy `copero-` (zustand persist v1, formato kebab-case
 *     que data de los primeros PRs del simulador)
 *
 * NO toca:
 *   - Keys de otros productos / librerías que compartan el AsyncStorage
 *     nativo de la app (no hay hoy, pero el filtro es defensivo).
 *   - Preferences nativas iOS/Android (NSUserDefaults / SharedPreferences)
 *     — esas las maneja AdMob / Expo SecureStore y se aíslan del
 *     AsyncStorage de RN.
 *
 * Devuelve la lista de keys removidas (para logs y para el test de
 * regresión `restart-clears-all-keys`).
 *
 * Resiliencia:
 *   - Si AsyncStorage nativo no está disponible (memoryStorage fallback
 *     en vitest), opera sobre el fallback para que el test corra igual.
 *   - Errores en `getAllKeys` o `multiRemove` no abortan el barrido: el
 *     log de keys removidas es best-effort y un fallo parcial no debe
 *     dejar al usuario con una pantalla de fin de carrera inconsistente.
 */
const COPERO_PREFIXES = ['copero:', 'copero-'] as const;

function isCoperoKey(k: string): boolean {
  return COPERO_PREFIXES.some((p) => k.startsWith(p));
}

export async function listCoperoKeys(): Promise<string[]> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return [];
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && isCoperoKey(k)) out.push(k);
    }
    return out;
  }
  try {
    const all = await AsyncStorage.getAllKeys();
    return all.filter(isCoperoKey);
  } catch {
    // Si AsyncStorage nativo no expone getAllKeys (vieja API) caemos a
    // remoción explícita de keys conocidas — el caller termina con disco
    // igualmente limpio.
    return [];
  }
}

export async function wipeAllCoperoKeys(): Promise<string[]> {
  const keys = await listCoperoKeys();
  if (keys.length === 0) return keys;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      for (const k of keys) {
        try {
          window.localStorage.removeItem(k);
        } catch {
          // best-effort: seguimos con las siguientes keys.
        }
      }
    }
    return keys;
  }

  try {
    // AsyncStorage.removeMany acepta hasta N keys por llamada (Android
    // tiene un cap alrededor de 1500; acá N es chico). La API legacy
    // era `multiRemove` — la renombraron en 2.x pero sigue habiendo
    // shims en versiones anteriores; usar removeMany (canónico) y caer
    // a removeItem individual si la versión nativa no lo soporta.
    await AsyncStorage.removeMany(keys);
  } catch {
    // Fallback: removemos una por una. removeMany atómico falla
    // completo en algunos devices viejos; remover secuencial es más
    // robusto aunque deja una ventana parcial si el proceso muere a
    // mitad — la próxima `wipeAllCoperoKeys` (siguiente restart) limpia
    // el resto.
    await Promise.all(
      keys.map((k) =>
        AsyncStorage.removeItem(k).catch(() => {
          // best-effort individual.
        }),
      ),
    );
  }
  return keys;
}