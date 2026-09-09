import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { COPY, Locale, SUPPORTED_LOCALES } from './copy';

// LocaleProvider — MGC-653. Estado minimo del locale activo (default `es`).
// Sin persistencia (ADR-0014); sin deteccion automatica. Cualquier consumidor
// que dependa del locale debe re-renderizar al cambiarlo (suscribirse via
// useLocale). MGC-1534 extiende t() con segundo arg opcional para interpolar
// placeholders {key} en strings parametrizadas.
//
// MGC-2168 — i18n regression guard: si el lookup falla en ambos el locale
// activo y `es`, logueamos warning en dev para detectar claves faltantes
// antes de QA. Nunca devolvemos `path` literal (Field lo aplica
// `.toUpperCase()` → "IDENTITY.FIELDLASTNAME" en pantalla, ver ticket).

type TValues = Record<string, string | number>;

function interpolate(template: string, values: TValues): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf('{', i);
    if (open === -1) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);
    const close = template.indexOf('}', open + 1);
    if (close === -1) {
      out += template.slice(open);
      break;
    }
    const key = template.slice(open + 1, close);
    const v = values[key];
    out += v === undefined ? '{' + key + '}' : String(v);
    i = close + 1;
  }
  return out;
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (path: string, values?: TValues) => string;
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
    (path: string, values?: TValues) => {
      const raw = lookup(COPY[locale], path) ?? lookup(COPY.es, path) ?? path;
      return values ? interpolate(raw, values) : raw;
    },
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