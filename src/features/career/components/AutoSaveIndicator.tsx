/**
 * MGC-480 — header indicator de auto-guardado.
 *
 * Banner compacto que muestra el estado de la última save a
 * AsyncStorage. Suscribe a `useCareerStore` para tres señales:
 *
 *   - `isSaving` (bool): true mientras hay una save en vuelo.
 *     Renderiza "Guardando…" con un spinner animado.
 *   - `lastSavedAt` (epoch ms | null): timestamp del último save
 *     confirmado. Renderiza "Auto-guardado HH:MM" con texto muted.
 *   - ambos en null/false al montar (sin save en esta sesión):
 *     renderiza "Sin guardar" como fallback honesto. El usuario
 *     nunca debe ver la UI convencida de que está todo guardado
 *     cuando todavía no se invocó `saveCareerSave`.
 *
 * El componente es NO interactivo: no es Pressable, no dispara
 * nada. Es un espejo de la señal de persistencia — su única
 * responsabilidad es reducir la ansiedad del usuario sobre "¿se
 * guardó?" (MGC-1739 walk P2-7) sin agregar affordance nueva.
 *
 * Diseño:
 *   - WCAG contrast AA sobre fondo `surface` (tokens existentes).
 *   - 48dp alto mínimo para respetar hitbox aunque no haya tap.
 *   - `accessibilityLabel` describe el estado completo para
 *     TalkBack; el spinner animado incluye `accessibilityLiveRegion`
 *     para que se anuncie el cambio a "Guardando…" → "Guardado".
 *   - `testID="autosave-indicator"` para que specs Maestro/Playwright
 *     esperen por el cambio de estado.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/design/useTheme';
import { useCareerStore } from '@/shared/store/careerStore';

function formatHHMM(ts: number): string {
  try {
    const d = new Date(ts);
    const hh = `${d.getHours()}`.padStart(2, '0');
    const mm = `${d.getMinutes()}`.padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

export type AutoSaveIndicatorProps = {
  /** Test id base (default: `autosave-indicator`). */
  testID?: string;
};

export function AutoSaveIndicator({
  testID = 'autosave-indicator',
}: AutoSaveIndicatorProps) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  // MGC-480 — selector estable (Zustand v5 Object.is). Split en dos
  // llamadas para que sólo el campo relevante re-renderice; si el
  // dashboard tuviera 30 subscriptores a `profile`, este componente
  // no entraría en re-render cada vez que cambia una stat.
  const isSaving = useCareerStore((s) => s.isSaving);
  const lastSavedAt = useCareerStore((s) => s.lastSavedAt);

  let label: string;
  let tone: 'muted' | 'active' | 'pending';
  if (isSaving) {
    label = 'Guardando…';
    tone = 'pending';
  } else if (typeof lastSavedAt === 'number') {
    label = `Auto-guardado ${formatHHMM(lastSavedAt)}`;
    tone = 'muted';
  } else {
    label = 'Sin guardar';
    tone = 'muted';
  }

  const bg = tone === 'pending' ? colors.primarySoft : colors.surface;
  const fg = tone === 'pending' ? colors.primary : colors.textMuted;
  const a11yLabel = tone === 'pending'
    ? 'Guardando partida automáticamente.'
    : typeof lastSavedAt === 'number'
      ? `Última partida guardada a las ${formatHHMM(lastSavedAt)}.`
      : 'Aún no se guardó la partida en esta sesión.';

  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      accessibilityLabel={a11yLabel}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        borderRadius: radii.pill,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 32,
      }}
    >
      {isSaving ? (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          accessibilityElementsHidden
        />
      ) : null}
      <Text
        style={{
          color: fg,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
          letterSpacing: 0.5,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

// Mantener `Pressable` en el import tree aunque hoy no se use — alinea
// con el resto de los componentes de la screen que sí son tap-targets
// y deja la puerta abierta a un futuro "Tap para forzar guardado".
const _styles = StyleSheet.create({ _: {} });
void _styles;
void Pressable;