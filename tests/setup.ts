// Polyfill localStorage para jsdom + vitest 2.x en node 22+.
// jsdom 25 no expone `window.localStorage` por defecto; forzamos uno en memoria.
import { vi } from 'vitest'

// MGC-215 — mock global de `@react-native-async-storage/async-storage`
// para que `lib/storage.ts` y `shared/store/storage.ts` (que importan
// AsyncStorage directo) operen contra un shim en memoria. Sin esto,
// el módulo nativo falla al cargar en vitest (CJS internals rotos) y
// los tests que tocan storage no resuelven.
//
// La API expuesta es mínima: lo que consume Copero (getItem/setItem/
// removeItem/getAllKeys/removeMany/clear). Cualquier test que quiera
// resetear el storage entre casos debe importar este mapa y hacer
// `__asyncStorageMem.clear()` en su `beforeEach`.
type AsyncStorageMap = Map<string, string>
export const __asyncStorageMem: AsyncStorageMap = new Map()

vi.mock('@react-native-async-storage/async-storage', () => {
  return {
    default: {
      async getItem(key: string): Promise<string | null> {
        return __asyncStorageMem.has(key) ? __asyncStorageMem.get(key)! : null
      },
      async setItem(key: string, value: string): Promise<void> {
        __asyncStorageMem.set(key, String(value))
      },
      async removeItem(key: string): Promise<void> {
        __asyncStorageMem.delete(key)
      },
      async getAllKeys(): Promise<string[]> {
        return Array.from(__asyncStorageMem.keys())
      },
      async removeMany(keys: string[]): Promise<void> {
        for (const k of keys) __asyncStorageMem.delete(k)
      },
      async clear(): Promise<void> {
        __asyncStorageMem.clear()
      },
    },
  }
})

type StorageMap = Map<string, string>

const memoryStorage: StorageMap = new Map()

const createStorage = (): Storage => {
  const storage: Storage = {
    get length() {
      return memoryStorage.size
    },
    clear() {
      memoryStorage.clear()
    },
    getItem(key: string) {
      return memoryStorage.has(key) ? memoryStorage.get(key)! : null
    },
    key(index: number) {
      return Array.from(memoryStorage.keys())[index] ?? null
    },
    removeItem(key: string) {
      memoryStorage.delete(key)
    },
    setItem(key: string, value: string) {
      memoryStorage.set(key, String(value))
    },
  }
  return storage
}

if (typeof window !== 'undefined') {
  if (typeof (window as any).localStorage === 'undefined' || !(window as any).localStorage) {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      writable: true,
      value: createStorage(),
    })
  }
  if (typeof (window as any).matchMedia === 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  }
}
