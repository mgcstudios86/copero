/**
 * MGC-2006 — resolver i18n para las 28 keys `social_*` de F4 social events.
 *
 * El resto del catálogo del simulador-carrera sigue viviendo sólo en
 * `es-AR` (la mayoría de los screens no necesitan i18n en esta iteración).
 * Este helper expone la mínima API que necesita `social-events.tsx` para
 * resolver el copy correcto según el `locale` activo del `LocaleProvider`
 * (MGC-653 / MGC-1570 / MGC-1648).
 *
 * Patrón de uso:
 *
 *   const t = useSocialCopy();
 *   t('social_timba_title');           // → string localizado
 *   t('social_events_mods_odds_luck',  // → con interpolación
 *     { pct: 12, gate: 50 });
 *
 * Locales soportados: `es` (es-AR, default), `en`, `zh-CN`. Cualquier
 * locale no soportado cae a `es` (es-AR).
 */
import { useMemo } from 'react';
import { useLocale } from '@/i18n/locale-context';
import type { Locale } from '@/i18n/copy';
import { copy as esArCopy } from './es-AR/simulador-carrera';
import { copy as enCopy } from './en-US/simulador-carrera';
import { copy as zhCopy } from './zh-CN/simulador-carrera';
import type { CopyMatrix } from './es-AR/simulador-carrera';

/**
 * Mapa locale → CopyMatrix (subset i18n de las 28 social_*).
 *
 * MGC-357 — el helper sólo traduce `es`/`en`/`zh-CN` hoy. `pt-BR` (y
 * cualquier locale futuro agregado a `SUPPORTED_LOCALES`) cae al
 * fallback `esArCopy` vía el `?.` de la línea 51 — no necesitamos
 * poblar `pt-BR` acá hasta que se traduzca el subset de social_*.
 * Usamos `Partial<Record<Locale, CopyMatrix>>` para que el tipo
 * refleje exactamente la realidad: subset parcial de locales
 * soportados, no un set cerrado que se rompa cada vez que el
 * `Locale` type se extiende.
 */
const LOCALE_COPY: Partial<Record<Locale, CopyMatrix>> = {
  es: esArCopy,
  en: enCopy,
  'zh-CN': zhCopy,
};

export type SocialT = (
  id: string,
  values?: Record<string, string | number>,
) => string;

/**
 * Hook que devuelve una función `t(id, values)` resolviendo contra el
 * CopyMatrix del locale activo. Re-memoiza sólo cuando cambia `locale`,
 * así no rompe la referencialidad que esperan `useCallback` en el screen.
 */
export function useSocialCopy(): SocialT {
  const { locale } = useLocale();
  return useMemo<SocialT>(
    () =>
      (id: string, values?: Record<string, string | number>) =>
        LOCALE_COPY[locale]?.resolve(id, values) ??
        esArCopy.resolve(id, values),
    [locale],
  );
}