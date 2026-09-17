import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { COPY, Locale, SUPPORTED_LOCALES } from './copy';

// LocaleProvider — MGC-653 (estado) + MGC-320 (persistencia + pt-BR).
//
// Estado minimo del locale activo (default `es`). MGC-320 introdujo:
//   - `LOCALE_STORAGE_KEY`: persiste la elección del usuario en
//     AsyncStorage (claves `copero:locale`). Tras un force-stop + relaunch,
//     el boot hidrata el locale elegido y todo el árbol React (incluido el
//     home body) se monta en ese idioma (Bug C del padre MGC-306).
//   - Soporte para `pt-BR` en SUPPORTED_LOCALES (Bug A del padre).
//   - Web: usa `localStorage` (jsdom en tests + browser en producción);
//     nativo: usa `@react-native-async-storage/async-storage`. Mismo API,
//     misma clave — la rama se elige en runtime según Platform.OS.
//
// MGC-1534 extiende t() con segundo arg opcional para interpolar
// placeholders {key} en strings parametrizadas.
//
// MGC-2168 — i18n regression guard: si el lookup falla en ambos el locale
// activo y `es`, logueamos warning en dev para detectar claves faltantes
// antes de QA. Nunca devolvemos `path` literal (Field lo aplica
// `.toUpperCase()` → "IDENTITY.FIELDLASTNAME" en pantalla, ver ticket).

const LOCALE_STORAGE_KEY = 'copero:locale';

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

async function readStoredLocale(): Promise<Locale | null> {
  try {
    // MGC-320 — Web bundle (expo-router export) usa localStorage; nativo
    // (APK / IPA) usa AsyncStorage. La rama por Platform.OS evita
    // require-time del módulo nativo en el bundle web.
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return null;
      const v = window.localStorage?.getItem(LOCALE_STORAGE_KEY);
      return v && (SUPPORTED_LOCALES as readonly string[]).includes(v) ? (v as Locale) : null;
    }
    const v = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    return v && (SUPPORTED_LOCALES as readonly string[]).includes(v) ? (v as Locale) : null;
  } catch {
    // Falla best-effort: si el storage no responde, arrancamos en `es`.
    return null;
  }
}

async function writeStoredLocale(locale: Locale): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      window.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
      return;
    }
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Falla best-effort: si el storage no responde, la UI sigue
    // funcionando con el locale en memoria hasta el próximo cold-start.
  }
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // MGC-320 — arrancamos en `es` para evitar el flicker del primer
  // render con strings en español antes de re-hidratar al locale
  // persistido. La hidratación posterior vía `setLocale` dispara el
  // re-render con los strings correctos (los screens consumidores están
  // suscritos a `useLocale()`).
  const [locale, setLocaleState] = useState<Locale>('es');

  // Hidratar locale persistido en el primer mount. MGC-320 — Bug C
  // del padre MGC-306: tras force-stop + relaunch, el chip del
  // LanguageSwitcher y el body del home deben volver al último idioma
  // elegido por el usuario (no resetear a `es`).
  useEffect(() => {
    let cancelled = false;
    void readStoredLocale().then((stored) => {
      if (cancelled || !stored) return;
      if (stored !== locale) setLocaleState(stored);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    if (!SUPPORTED_LOCALES.includes(next)) return;
    setLocaleState(next);
    void writeStoredLocale(next);
  }, []);

  const t = useCallback(
    (path: string, values?: TValues) => {
      // MGC-2168 — i18n regression guard. Si el lookup falla en ambos el
      // locale activo y `es`, logueamos un warning en dev para que el equipo
      // detecte claves faltantes antes de que lleguen a QA. Nunca devolvemos
      // el `path` literal porque `Field` lo aplica `.toUpperCase()` y termina
      // como "IDENTITY.FIELDLASTNAME" en pantalla (ver ticket).
      const fromActive = lookup(COPY[locale], path);
      const fromEs = fromActive ?? lookup(COPY.es, path);
      if (fromEs === undefined) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] missing key: ${path} (locale=${locale})`);
        }
        return path;
      }
      const raw = fromActive ?? fromEs;
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