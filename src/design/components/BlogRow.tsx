import React from 'react';
import { Pressable, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';

/**
 * BlogRow — MGC-555 PR6 + MGC-605 followups.
 *
 * Item de lista vertical según spec copero.com.ar §6.7
 * (`design/copero-ar-visual-spec.md`). Fila con:
 * - Padding vertical 16px.
 * - Border-bottom 1px `colors.border` (entre filas).
 * - Título Inter 15px weight 600, máximo 2 líneas (line-clamp).
 * - Tag chips debajo: badge pequeño bg `colors.accent`, texto 11px
 *   `colors.textMuted` uppercase + icono del deporte.
 * - Meta alineada derecha: "Hace N sem" + nombre autor (12px textMuted).
 * - Divider horizontal completo entre filas.
 *
 * MGC-605:
 *  - H2: Título usa `colors.textStrong` (no literal #FFFFFF) — en light
 *    theme `surface` es #FFFFFF y el título caía invisible. Lección
 *    MGC-577 + MGC-579 (texto sobre fondo plano del theme, no sobre
 *    overlay/imagen como en HeroCard).
 *  - H6: Sin `onPress` la fila es `accessible` con `accessibilityLabel`
 *    combinado título + meta + tags. Antes `accessible: false` la hacía
 *    invisible para screen readers aunque la fila visible seguía ahí.
 *
 * A11y:
 * - Fila navegable si se pasa `onPress`, `accessibilityRole="button"`.
 * - Sin `onPress` la fila sigue siendo accesible (`text`) con label
 *   combinado título + meta + tags.
 * - `accessibilityLabel` combina título + meta + tags para lectura completa.
 */

export type BlogRowTag = {
  id: string;
  label: string;
  /** Emoji o glifo simple (1 char). Para íconos del deporte. */
  icon?: string;
};

export type BlogRowProps = {
  title: string;
  tags: BlogRowTag[];
  /** Texto relativo tipo "Hace 3 sem". */
  relativeTime: string;
  author: string;
  onPress?: () => void;
  testID?: string;
  /** Override del accessibilityLabel completo. */
  accessibilityLabel?: string;
};

export function BlogRow({
  title,
  tags,
  relativeTime,
  author,
  onPress,
  testID = 'copero-blog-row',
  accessibilityLabel,
}: BlogRowProps) {
  const { colors, spacing, fontSize, fontWeight, fontFamily, borderWidth } = useTheme();

  const a11yDefault = [title, relativeTime, author, tags.map((t) => t.label).join(', ')]
    .filter(Boolean)
    .join('. ');

  const containerStyle: ViewStyle = {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: colors.border,
  };

  const interactiveProps = onPress
    ? {
        onPress,
        accessibilityRole: 'button' as const,
        accessibilityLabel: accessibilityLabel ?? a11yDefault,
      }
    : {
        // H6 (MGC-605): sin onPress la fila sigue siendo accesible como
        // texto. Antes `accessible: false` la dejaba invisible para
        // TalkBack/VoiceOver aunque la fila visible seguía renderizando.
        accessible: true,
        accessibilityRole: 'text' as const,
        accessibilityLabel: accessibilityLabel ?? a11yDefault,
      };

  return (
    <Pressable
      {...interactiveProps}
      testID={testID}
      style={({ pressed }) => ({
        ...containerStyle,
        backgroundColor: pressed && onPress ? colors.surface2 : 'transparent',
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, marginRight: spacing[3] }}>
          <Text
            numberOfLines={2}
            style={{
              // H2 (MGC-605): colors.textStrong reemplaza el #FFFFFF
              // literal. En light `surface = #FFFFFF` y el título caía
              // invisible. Lección MGC-577 + MGC-579: literal blanco sólo
              // sobre overlay/imagen (HeroCard), nunca sobre surface plano.
              color: colors.textStrong,
              fontFamily: fontFamily.body,
              fontSize: 15,
              fontWeight: fontWeight.semibold,
              lineHeight: 15 * 1.35,
            }}
          >
            {title}
          </Text>
          {tags.length > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginTop: spacing[2],
              }}
            >
              {tags.map((tag) => (
                <TagChip key={tag.id} tag={tag} testID={`${testID}-tag-${tag.id}`} />
              ))}
            </View>
          ) : null}
        </View>
        <View
          style={{
            alignItems: 'flex-end',
            minWidth: 96,
          }}
        >
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: fontFamily.body,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.regular,
              textAlign: 'right',
            }}
          >
            {relativeTime}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: colors.textMuted,
              fontFamily: fontFamily.body,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.regular,
              marginTop: spacing[1],
              textAlign: 'right',
            }}
          >
            {author}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function TagChip({ tag, testID }: { tag: BlogRowTag; testID: string }) {
  const { colors, spacing, fontWeight, fontFamily, radii } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`Tag ${tag.label}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
        borderRadius: radii.sm,
        backgroundColor: colors.accentSoft,
        marginRight: spacing[1],
        marginBottom: spacing[1],
      }}
    >
      {tag.icon ? (
        <Text
          accessible={false}
          style={{
            color: colors.textMuted,
            fontFamily: fontFamily.body,
            fontSize: 11,
            marginRight: 4,
          }}
        >
          {tag.icon}
        </Text>
      ) : null}
      <Text
        style={{
          color: colors.textMuted,
          fontFamily: fontFamily.display,
          fontSize: 11,
          fontWeight: fontWeight.bold,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {tag.label}
      </Text>
    </View>
  );
}
