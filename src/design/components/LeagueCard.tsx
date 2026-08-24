import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  ViewStyle,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../useTheme';
import { PillButton } from './PillButton';

/** Spec §6.6: cards 200×140 desktop / 140×100 mobile. Breakpoint 600px. */
const MOBILE_BREAKPOINT = 600;

/** Spec §6.5/§6.6: degradado bottom-up para overlay oscuro (ref §6.2 HeroCard). */
const GRADIENT_STOPS = [
  'rgba(0,0,0,0)',
  'rgba(0,0,0,0.05)',
  'rgba(0,0,0,0.20)',
  'rgba(0,0,0,0.45)',
  'rgba(0,0,0,0.70)',
  'rgba(0,0,0,0.85)',
];

/**
 * LeagueCard — MGC-555 PR5.
 *
 * Card oscura usada en dos variantes según spec copero.com.ar
 * (`design/copero-ar-visual-spec.md`):
 * - `variant="resultados"` (§6.4): header con logo + nombre de liga,
 *   lista de partidos con escudo/equipo/hora. Layout móvil 1 col,
 *   desktop 3 col (delegado al caller).
 * - `variant="prodes"` (§6.5): imagen full-bleed + overlay gradient,
 *   badge DISPONIBLE verde, título, sub-info participantes, PillButton
 *   "Jugar ahora".
 *
 * El componente es presentacional — no conoce navigation. Si el caller
 * quiere `onPress` en filas (Resultados) o en PillButton (Prodes), los
 * pasa por props.
 *
 * A11y:
 * - Resultados: header navegable si se pasa `onHeaderPress`, partidos
 *   navegables fila por fila.
 * - Prodes: card interactiva con accessibilityRole="button" cuando se
 *   pasa `onPress`.
 * - Contraste: texto blanco (#FFFFFF) sobre overlay oscuro en Prodes;
 *   texto `colors.text` sobre `colors.surface` en Resultados.
 */

export type LeagueMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  /** Hora del partido en formato HH:MM local. */
  time: string;
  /** URL del escudo del equipo home (16×16). Si falta, renderiza placeholder. */
  homeCrestUrl?: string;
  /** URL del escudo del equipo away. Si falta, renderiza placeholder. */
  awayCrestUrl?: string;
};

type CommonProps = {
  testID?: string;
  /** Override del label para TalkBack/VoiceOver. Si falta, deriva del contenido. */
  accessibilityLabel?: string;
};

export type LeagueCardProps =
  | (CommonProps & {
      variant: 'resultados';
      leagueName: string;
      leagueLogoUrl?: string;
      matches: LeagueMatch[];
      onMatchPress?: (match: LeagueMatch) => void;
      onHeaderPress?: () => void;
    })
  | (CommonProps & {
      variant: 'prodes';
      title: string;
      imageUrl: string;
      participants: number;
      onPress?: () => void;
    });

export function LeagueCard(props: LeagueCardProps) {
  if (props.variant === 'prodes') {
    return <LeagueCardProdes {...props} />;
  }
  return <LeagueCardResultados {...props} />;
}

function LeagueCardResultados({
  leagueName,
  leagueLogoUrl,
  matches,
  onMatchPress,
  onHeaderPress,
  testID = 'copero-league-card-resultados',
  accessibilityLabel,
}: Extract<LeagueCardProps, { variant: 'resultados' }>) {
  const { colors, spacing, fontSize, fontWeight, fontFamily, radii, borderWidth } = useTheme();

  const containerStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    overflow: 'hidden',
    width: '100%',
  };

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? `Resultados ${leagueName}`}
      accessibilityRole="summary"
      testID={testID}
      style={containerStyle}
    >
      <Pressable
        onPress={onHeaderPress}
        disabled={!onHeaderPress}
        accessibilityRole={onHeaderPress ? 'button' : undefined}
        accessibilityLabel={`${leagueName}, ${matches.length} partidos`}
        testID={`${testID}-header`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[4],
          backgroundColor: pressed && onHeaderPress ? colors.surface2 : 'transparent',
        })}
      >
        <LeagueBadge logoUrl={leagueLogoUrl} size={32} radius={radii.md} testID={`${testID}-badge`} />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            marginLeft: spacing[3],
            color: colors.textStrong,
            fontFamily: fontFamily.display,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {leagueName}
        </Text>
        <Text
          accessible={false}
          style={{
            color: colors.textMuted,
            fontFamily: fontFamily.body,
            fontSize: fontSize.sm,
            marginLeft: spacing[2],
          }}
        >
          ⌄
        </Text>
      </Pressable>

      <View style={{ borderTopWidth: borderWidth.hairline, borderTopColor: colors.border }}>
        {matches.map((match, idx) => (
          <MatchRow
            key={match.id}
            match={match}
            isLast={idx === matches.length - 1}
            onPress={onMatchPress ? () => onMatchPress(match) : undefined}
            testID={`${testID}-match-${match.id}`}
          />
        ))}
      </View>
    </View>
  );
}

function MatchRow({
  match,
  isLast,
  onPress,
  testID,
}: {
  match: LeagueMatch;
  isLast: boolean;
  onPress?: () => void;
  testID: string;
}) {
  const { colors, spacing, fontSize, fontWeight, fontFamily, borderWidth } = useTheme();

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: isLast ? 0 : borderWidth.hairline,
    borderBottomColor: colors.border,
  };

  const interactiveProps = onPress
    ? {
        onPress,
        accessibilityRole: 'button' as const,
        accessibilityLabel: `${match.homeTeam} vs ${match.awayTeam}, ${match.time}`,
      }
    : { accessible: false };

  return (
    <Pressable
      {...interactiveProps}
      testID={testID}
      style={({ pressed }) => ({
        ...containerStyle,
        backgroundColor: pressed ? colors.accent : 'transparent',
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <CrestImage url={match.homeCrestUrl} size={16} />
        <Text
          numberOfLines={1}
          style={{
            marginLeft: spacing[2],
            color: colors.text,
            fontFamily: fontFamily.body,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.regular,
          }}
        >
          {match.homeTeam}
        </Text>
        <Text
          style={{
            marginHorizontal: spacing[2],
            color: colors.textMuted,
            fontFamily: fontFamily.body,
            fontSize: fontSize.sm,
          }}
        >
          vs
        </Text>
        <CrestImage url={match.awayCrestUrl} size={16} />
        <Text
          numberOfLines={1}
          style={{
            marginLeft: spacing[2],
            color: colors.text,
            fontFamily: fontFamily.body,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.regular,
            flex: 1,
          }}
        >
          {match.awayTeam}
        </Text>
      </View>
      <Text
        style={{
          color: colors.textMuted,
          fontFamily: fontFamily.body,
          fontSize: 13,
          fontWeight: fontWeight.regular,
        }}
      >
        {match.time}
      </Text>
    </Pressable>
  );
}

function LeagueCardProdes({
  title,
  imageUrl,
  participants,
  onPress,
  testID = 'copero-league-card-prodes',
  accessibilityLabel,
}: Extract<LeagueCardProps, { variant: 'prodes' }>) {
  const { colors, spacing, fontSize, fontWeight, fontFamily, radii } = useTheme();

  const containerStyle: ViewStyle = {
    borderRadius: radii.xl,
    overflow: 'hidden',
    width: '100%',
    minHeight: 200,
    backgroundColor: colors.surface2,
    ...(Platform.OS === 'web' ? { position: 'relative' as const } : null),
  };

  // Fix #5 (a11y nested Pressable): la card entera NO es Pressable cuando
  // hay CTA propio. TalkBack/VoiceOver leerían dos botones anidados. La
  // card entera queda como "summary" informativa y el PillButton es el
  // único botón accesible.
  const hasCta = typeof onPress === 'function';
  const a11yLabel = accessibilityLabel ?? `${title}, ${participants} participantes`;

  const body = (
    <>
      <ProdesImage imageUrl={imageUrl} testID={`${testID}-image`} />
      {/* Fix #3 (gradient overlay): capas de rgba decreciente en lugar de un
          backgroundColor plano — replica el degradado de HeroCard §6.2. */}
      {GRADIENT_STOPS.map((color, idx) => (
        <View
          key={`grad-${idx}`}
          accessibilityElementsHidden
          importantForAccessibility="no"
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: color,
          }}
        />
      ))}
      <View
        style={{
          ...(Platform.OS === 'web' ? { position: 'absolute' as const } : null),
          bottom: 0,
          left: 0,
          right: 0,
          padding: spacing[4],
          justifyContent: 'flex-end',
          minHeight: '100%',
        }}
      >
        <View
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: spacing[2],
            paddingVertical: spacing[1],
            borderRadius: radii.pill,
            backgroundColor: colors.success,
            marginBottom: spacing[2],
          }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: fontFamily.display,
              fontSize: 11,
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            DISPONIBLE
          </Text>
        </View>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            color: '#FFFFFF',
            fontFamily: fontFamily.display,
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
            lineHeight: fontSize.md * 1.2,
            marginBottom: spacing[2],
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: spacing[3],
          }}
        >
          <Text
            accessible={false}
            style={{
              color: '#FFFFFF',
              fontFamily: fontFamily.body,
              fontSize: fontSize.xs,
              marginRight: spacing[1],
              opacity: 0.85,
            }}
          >
            ⚲
          </Text>
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: fontFamily.body,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.regular,
              opacity: 0.85,
            }}
          >
            {participants} participantes
          </Text>
        </View>
        {hasCta ? (
          <PillButton
            label="Jugar ahora"
            onPress={onPress!}
            testID={`${testID}-cta`}
          />
        ) : null}
      </View>
    </>
  );

  // Sin CTA: card informativa (role summary). Con CTA: card NO interactiva,
  // el PillButton adentro es el único botón accesible.
  if (hasCta) {
    return (
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={a11yLabel}
        testID={testID}
        style={containerStyle}
      >
        {body}
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={a11yLabel}
      testID={testID}
      style={containerStyle}
    >
      {body}
    </View>
  );
}

function LeagueBadge({
  logoUrl,
  size,
  radius,
  testID,
}: {
  logoUrl?: string;
  size: number;
  radius: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        backgroundColor: colors.surface2,
      }}
    >
      {logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          accessibilityIgnoresInvertColors
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}

function CrestImage({ url, size }: { url?: string; size: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: colors.surface2,
      }}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          accessibilityIgnoresInvertColors
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}

function ProdesImage({ imageUrl, testID }: { imageUrl: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ backgroundColor: colors.surface2, width: '100%', height: 240 }}>
      <Image
        source={{ uri: imageUrl }}
        accessibilityIgnoresInvertColors
        style={{
          width: '100%',
          height: '100%',
          ...(Platform.OS === 'web' ? ({ objectFit: 'cover' } as const) : null),
        }}
        resizeMode="cover"
      />
    </View>
  );
}

/**
 * AccesosDirectos — MGC-555 PR5.
 *
 * Carrusel horizontal de 5 cards pequeñas según spec copero.com.ar §6.6.
 * Width 200px, height 140px desktop / 140×100 mobile. Background image
 * cover, overlay gradient bottom, título Inter 14px semibold blanco
 * centrado bottom, border-radius md (6px → spec; tokens `radii.md = 8`).
 *
 * Se renderiza con `ScrollView horizontal` para native; en web funciona
 * igual vía `-webkit-overflow-scrolling: touch` implícito.
 *
 * El caller decide los items (label + imageUrl + onPress opcional).
 */

export type AccesoDirectoItem = {
  id: string;
  title: string;
  imageUrl: string;
  onPress?: () => void;
};

export function AccesosDirectos({
  items,
  testID = 'copero-accesos-directos',
}: {
  items: AccesoDirectoItem[];
  testID?: string;
}) {
  const { colors, fontSize, fontWeight, fontFamily, spacing, radii } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="list"
      testID={testID}
      contentContainerStyle={{
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2],
      }}
    >
      {items.map((item) => (
        <AccesoDirectoCard
          key={item.id}
          item={item}
          colors={colors}
          fontSize={fontSize}
          fontWeight={fontWeight}
          fontFamily={fontFamily}
          spacing={spacing}
          radii={radii}
        />
      ))}
    </ScrollView>
  );
}

/** Hook util para mobile breakpoint — centraliza la regla §6.6 (140×100). */
export function useIsMobileCard(): boolean {
  const { width } = useWindowDimensions();
  return width < MOBILE_BREAKPOINT;
}

function AccesoDirectoCard({
  item,
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radii,
}: {
  item: AccesoDirectoItem;
  colors: ReturnType<typeof useTheme>['colors'];
  fontSize: ReturnType<typeof useTheme>['fontSize'];
  fontWeight: ReturnType<typeof useTheme>['fontWeight'];
  fontFamily: ReturnType<typeof useTheme>['fontFamily'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  radii: ReturnType<typeof useTheme>['radii'];
}) {
  // Fix #1 (mobile breakpoint): spec §6.6 — 200×140 desktop, 140×100 mobile.
  const isMobile = useIsMobileCard();
  const cardWidth = isMobile ? 140 : 200;
  const cardHeight = isMobile ? 100 : 140;

  return (
    <Pressable
      onPress={item.onPress}
      disabled={!item.onPress}
      accessibilityRole={item.onPress ? 'button' : undefined}
      accessibilityLabel={item.title}
      testID={`copero-acceso-directo-${item.id}`}
      style={({ pressed }) => ({
        marginRight: spacing[3],
        width: cardWidth,
        height: cardHeight,
        borderRadius: radii.md,
        overflow: 'hidden',
        backgroundColor: colors.surface2,
        opacity: pressed ? 0.95 : 1,
        ...(Platform.OS === 'web' ? { position: 'relative' as const } : null),
      })}
    >
      <Image
        source={{ uri: item.imageUrl }}
        accessibilityIgnoresInvertColors
        style={{
          width: '100%',
          height: '100%',
          ...(Platform.OS === 'web' ? ({ objectFit: 'cover' } as const) : null),
        }}
        resizeMode="cover"
      />
      {/* Fix #3 (gradient overlay): capas de rgba en lugar de backgroundColor plano. */}
      {GRADIENT_STOPS.map((color, idx) => (
        <View
          key={`grad-${idx}`}
          accessibilityElementsHidden
          importantForAccessibility="no"
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: color,
          }}
        />
      ))}
      <View
        style={{
          ...(Platform.OS === 'web' ? { position: 'absolute' as const } : null),
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: spacing[2],
          paddingVertical: spacing[2],
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <Text
          numberOfLines={2}
          style={{
            color: '#FFFFFF',
            fontFamily: fontFamily.body,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            textAlign: 'center',
            lineHeight: fontSize.sm * 1.25,
          }}
        >
          {item.title}
        </Text>
      </View>
    </Pressable>
  );
}