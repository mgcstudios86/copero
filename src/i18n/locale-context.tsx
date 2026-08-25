import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { COPY, Locale, SUPPORTED_LOCALES } from './copy';

/**
 * LocaleProvider — MGC-653.
 *
 * Estado mínimo del locale activo (default `es`). Sin persistencia (se
 * decide en ADR-0014 si se commitea a `AsyncStorage`); sin detección
 * automática del sistema (fuera de alcance del header). El `setLocale`
 * es libre; cualquier consumidor que dependa del locale debe re-renderizar.
 *
 * API:
 * - `locale`: locale activo
 * - `setLocale(next)`: cambia el locale
 * - `t(path)`: lookup con fallback a `es`
 */

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (path: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function lookup(obj: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('es');

  const setLocale = useCallback((next: Locale) => {
    if (!SUPPORTED_LOCALES.includes(next)) return;
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (path: string) => lookup(COPY[locale], path) ?? lookup(COPY.es, path) ?? path,
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale debe usarse dentro de <LocaleProvider>');
  return ctx;
}
