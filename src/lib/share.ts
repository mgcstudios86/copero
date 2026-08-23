/**
 * Helpers de share para el resultado del Tactical Compass.
 *
 * Tres destinos soportados:
 *   - Web: usa el share nativo (`navigator.share`) si está disponible;
 *     si no, abre ventanas con URLs a X (Twitter intent) y WhatsApp Web.
 *     Para captura de pantalla PNG en web usa `html-to-image` (cargado lazy).
 *   - Nativo (iOS / Android): captura el resultado con `react-native-view-shot`
 *     y abre el sheet del sistema con `expo-sharing`.
 *
 * El share se hace a partir de un PNG ya generado; `shareCardText` produce el
 * copy que acompaña al archivo.
 */

import { Platform, Linking } from 'react-native';
import type { CompassResult } from '@/lib/compass';

/** Texto del tweet / WhatsApp. */
export function shareCardText(result: CompassResult): string {
  const arch = result.nearestArchetype;
  const pct = Math.round(result.affinity);
  return [
    `Mi ideología futbolística: ${arch.name} (${pct}% de afinidad)`,
    'Hacé la tuya en el Ideología Futbolística del Copero.',
  ].join('\n');
}

/** URL para share X (Twitter) en web. */
export function xIntentUrl(text: string, url?: string): string {
  const params = new URLSearchParams({ text });
  if (url) params.set('url', url);
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/** URL para WhatsApp Web. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Comparte vía el sistema operativo. En web intenta `navigator.share`;
 * si no está disponible, abre la ventana de X. En nativo usa `expo-sharing`
 * con un PNG generado por `react-native-view-shot` (se carga desde la pantalla).
 *
 * `captureRef` es la referencia del componente a capturar (sólo se usa en nativo);
 * en web la captura se hace con `html-to-image` dentro de la pantalla y se pasa
 * el `dataUrl` como `pngDataUrl`.
 */
export type ShareInput = {
  result: CompassResult;
  /** Captura PNG ya generada. Web: data URL. Nativo: `file://...`. */
  pngUri: string;
  /** URL canónica para incluir en el share (opcional). */
  url?: string;
};

export async function shareResult(input: ShareInput): Promise<void> {
  const text = shareCardText(input.result);

  if (Platform.OS === 'web') {
    const nav =
      typeof navigator !== 'undefined' ? (navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
      }) : undefined;
    if (nav?.share) {
      try {
        await nav.share({
          title: 'Mi Ideología Futbolística',
          text,
          url: input.pngUri,
        });
        return;
      } catch {
        // user canceló o no soportado — caemos al fallback de X
      }
    }
    const target = xIntentUrl(text, input.url);
    if (typeof window !== 'undefined') {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  // Nativo: `expo-sharing` se carga lazy para no romper la build web.
  let sharingModule: typeof import('expo-sharing') | null = null;
  try {
    sharingModule = await import('expo-sharing');
  } catch {
    sharingModule = null;
  }
  if (sharingModule && (await sharingModule.isAvailableAsync())) {
    await sharingModule.shareAsync(input.pngUri, {
      mimeType: 'image/png',
      dialogTitle: 'Mi Ideología Futbolística',
    });
    return;
  }

  // Sin `expo-sharing` (Expo Go): abrir WhatsApp como último recurso.
  const wa = whatsappUrl(text);
  await Linking.openURL(wa);
}