// Polyfill localStorage para jsdom + vitest 2.x en node 22+.
// jsdom 25 no expone `window.localStorage` por defecto; forzamos uno en memoria.
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
