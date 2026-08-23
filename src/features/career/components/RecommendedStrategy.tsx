import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/design';
import { copy } from '@/design/copy/es-AR/simulador-carrera';
import { recommendStrategy } from '@/features/career/simulation';
import { strategyCopy } from '@/features/career/strategy';
import type { PlayerProfile } from '@/types/career';

/**
 * RecommendedStrategy — bloque "Estrategia recomendada" del dashboard.
 *
 * Lazy-loaded desde `app/simulador-carrera/dashboard.tsx` (MGC-482).
 * Mantiene `recommendStrategy` + `strategy.ts` (~10 KB) fuera del chunk
 * inicial de /dashboard. Si el motor no devuelve estrategia aplicable,
 * el componente devuelve `null` (no se renderiza la sección).
 *
 * Props:
 *  - profile: PlayerProfile actual del store.
 *  - testID: opcional, default `dashboard-recommended`.
 */
export interface RecommendedStrategyProps {
  profile: PlayerProfile;
  testID?: string;
}

export function RecommendedStrategy({
  profile,
  testID = 'dashboard-recommended',
}: RecommendedStrategyProps): React.ReactElement | null {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const recommended = recommendStrategy(profile);

  if (!recommended) return null;

  const meta = strategyCopy(recommended);
  const title = copy.resolve(meta.title);
  const bodyKey = meta.body;
  const body = bodyKey ? copy.resolve(bodyKey) : '';

  return (
    <View style={{ gap: spacing[2] }}>
      <Text
        style={{
          color: colors.text,
          fontSize: fontSize.md,
          fontWeight: fontWeight.bold,
        }}
        accessibilityRole="header"
      >
        {copy.resolve('dashboard_suggested_h2')}
      </Text>
      <View
        style={{
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: spacing[4],
          gap: spacing[2],
        }}
        testID={testID}
      >
        <Text style={{ color: colors.textStrong, fontWeight: fontWeight.semibold }}>
          {title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{body}</Text>
      </View>
    </View>
  );
}
