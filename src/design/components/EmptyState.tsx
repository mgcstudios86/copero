import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { Button } from './Button';

export type EmptyStateVariant = 'default' | 'compact';

type EmptyStateProps = {
  /** Eyebrow corto arriba del título (ej: "TROFEO", "CALENDARIO"). */
  eyebrow?: string;
  /** Título principal del estado vacío. */
  title: string;
  /** Descripción opcional con más contexto. */
  description?: string;
  /** Emoji/ícono ASCII a la izquierda del eyebrow. */
  icon?: string;
  /** CTA opcional. Si se omite, no se renderiza el botón. */
  action?: {
    label: string;
    onPress: () => void;
    testID?: string;
  };
  /** Variante visual. `compact` reduce padding para listas/drawers. */
  variant?: EmptyStateVariant;
  /** testID raíz para QA hooks. */
  testID?: string;
  /** Override de estilo del contenedor raíz. */
  style?: ViewStyle;
};

/**
 * MGC-42.C — EmptyState reutilizable del design system.
 *
 * Antes match/draft/post-match/social-events/fin-carrera/dashboard renderizaban
 * textos sueltos ("Sin eventos", "Sin trofeos", "Sin partidos") sin
 * jerarquía visual ni CTA. La auditoría UX MGC-44 marcó la falta de feedback
 * consistente como must-fix. EmptyState centraliza eyebrow + título +
 * descripción + CTA con padding coherente y roles accesibles.
 */
export function EmptyState({
  eyebrow,
  title,
  description,
  icon,
  action,
  variant = 'default',
  testID,
  style,
}: EmptyStateProps) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const isCompact = variant === 'compact';

  const containerStyle: ViewStyle = {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: isCompact ? spacing[3] : spacing[5],
    gap: isCompact ? spacing[2] : spacing[3],
    alignItems: isCompact ? 'flex-start' : 'center',
  };

  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      style={[containerStyle, style]}
    >
      {(eyebrow || icon) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
          }}
        >
          {icon ? (
            <Text style={{ fontSize: fontSize.md }} accessibilityElementsHidden importantForAccessibility="no">
              {icon}
            </Text>
          ) : null}
          {eyebrow ? (
            <Text
              style={{
                color: colors.primary,
                fontSize: fontSize.sm,
                letterSpacing: 2,
                fontWeight: fontWeight.bold,
              }}
            >
              {eyebrow}
            </Text>
          ) : null}
        </View>
      )}
      <Text
        style={{
          color: colors.textStrong,
          fontSize: isCompact ? fontSize.md : fontSize.lg,
          fontWeight: fontWeight.bold,
          textAlign: isCompact ? 'left' : 'center',
        }}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            color: colors.textMuted,
            fontSize: fontSize.sm,
            textAlign: isCompact ? 'left' : 'center',
            lineHeight: fontSize.sm * 1.4,
          }}
        >
          {description}
        </Text>
      ) : null}
      {action ? (
        <View style={{ marginTop: isCompact ? 0 : spacing[2] }}>
          <Button
            label={action.label}
            onPress={action.onPress}
            variant="secondary"
            size="md"
            testID={action.testID}
          />
        </View>
      ) : null}
    </View>
  );
}