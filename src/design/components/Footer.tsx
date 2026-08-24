import React from 'react';
import { Pressable, Text, View, ViewStyle, Platform, AccessibilityRole } from 'react-native';
import { useTheme } from '../useTheme';

/**
 * `contentinfo` es un rol ARIA estándar para el landmark <footer>, pero NO
 * figura en `AccessibilityRole` del RN 0.86.2 que tenemos pinned. Screen
 * readers modernos (VoiceOver/TalkBack) lo respetan. Cast explícito para
 * no romper tsc — mismo patrón que BannerAd (`complementary`).
 */
const CONTENTINFO_ROLE = 'contentinfo' as AccessibilityRole;

/**
 * Footer — MGC-555 PR7.
 *
 * Footer de página según spec copero.com.ar §6.8
 * (`design/copero-ar-visual-spec.md`):
 *
 * 4 columnas desktop, 1 columna centrada mobile:
 * 1. **Logo + social**: copero wordmark + botones redondos outline 1px
 *    para X / Instagram / Cafecito (íconos como glifos simples).
 * 2. **SECCIONES** (eyebrow uppercase) + links Fútbol / Juegos / Prodes / Blog.
 * 3. **DESTACADO** + Mundial 2026 / Prode Mundial / Libertadores /
 *    Sudamericana / Liga Profesional.
 * 4. **LEGAL Y CONTACTO** + Sobre nosotros / Privacidad / Cookies /
 *    Términos / Bases Prode Mundial / Contacto.
 *
 * Hairline divider arriba. Fila inferior con `© 2026 Copero` izquierda,
 * `Configurar cookies` centrada, `TEMA ☀ 🖥 🌙` derecha (toggle 3 modos).
 *
 * Color links: `colors.textMuted` en reposo, `colors.textStrong` en hover.
 *
 * El toggle de tema requiere un `onThemeToggle` opcional. Si no se provee,
 * el botón se renderiza pero queda deshabilitado. Esta decisión mantiene
 * la design lib pura: el Footer no conoce el contexto de theme (la mutación
 * de `preference` se hace en un PR separado cuando exista UI de settings).
 */

export type FooterLink = {
  id: string;
  label: string;
  onPress?: () => void;
  href?: string;
};

export type FooterSocial = {
  id: 'x' | 'instagram' | 'cafecito';
  /** Glifo o emoji (1 char). Para íconos reales: integrar react-native-vector-icons. */
  icon: string;
  onPress?: () => void;
};

export type FooterProps = {
  /** URL del logo (imagen). Si falta, renderiza wordmark textual. */
  logoUrl?: string;
  wordmark?: string;
  socials?: FooterSocial[];
  secciones?: FooterLink[];
  destacado?: FooterLink[];
  legal?: FooterLink[];
  onConfigurarCookies?: () => void;
  /** Modo activo del theme. Default `undefined` → toggle se renderiza pero inactivo. */
  themeMode?: 'light' | 'dark' | 'copero';
  onThemeToggle?: (next: 'light' | 'dark' | 'copero') => void;
  testID?: string;
};

export function Footer({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reservado para PR futuro que renderice <Image>
  logoUrl: _logoUrl,
  wordmark = 'Copero',
  socials,
  secciones,
  destacado,
  legal,
  onConfigurarCookies,
  themeMode,
  onThemeToggle,
  testID = 'copero-footer',
}: FooterProps) {
  const { colors, spacing, fontSize, fontWeight, fontFamily, borderWidth } = useTheme();

  const containerStyle: ViewStyle = {
    backgroundColor: colors.bg,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[6],
    paddingBottom: spacing[5],
  };

  return (
    <View testID={testID} accessibilityRole={CONTENTINFO_ROLE} style={containerStyle}>
      <FooterColumns
        wordmark={wordmark}
        socials={socials ?? defaultSocials}
        secciones={secciones}
        destacado={destacado}
        legal={legal}
      />
      <View
        style={{
          marginTop: spacing[6],
          paddingTop: spacing[4],
          borderTopWidth: borderWidth.hairline,
          borderTopColor: colors.border,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: fontFamily.body,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.regular,
          }}
        >
          © 2026 {wordmark}
        </Text>
        <Pressable
          onPress={onConfigurarCookies}
          disabled={!onConfigurarCookies}
          accessibilityRole={onConfigurarCookies ? 'button' : undefined}
          accessibilityLabel="Configurar cookies"
          testID={`${testID}-cookies`}
          hitSlop={spacing[2]}
        >
          <Text
            style={{
              color: onConfigurarCookies ? colors.textStrong : colors.textMuted,
              fontFamily: fontFamily.body,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.regular,
              textDecorationLine: 'underline',
            }}
          >
            Configurar cookies
          </Text>
        </Pressable>
        <ThemeToggle
          mode={themeMode}
          onChange={onThemeToggle}
          colors={colors}
          spacing={spacing}
          borderWidth={borderWidth}
        />
      </View>
    </View>
  );
}

function FooterColumns({
  wordmark,
  socials,
  secciones,
  destacado,
  legal,
}: Pick<FooterProps, 'wordmark' | 'socials' | 'secciones' | 'destacado' | 'legal'>) {
  const { spacing } = useTheme();
  const wordmarkText = wordmark ?? 'Copero';
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
      }}
    >
      <FooterColumn testID="copero-footer-col-logo" style={{ minWidth: 220, marginBottom: spacing[5] }}>
        <FooterWordmark text={wordmarkText} />
        <View
          style={{
            flexDirection: 'row',
            marginTop: spacing[4],
          }}
        >
          {(socials ?? defaultSocials).map((social) => (
            <SocialButton key={social.id} social={social} />
          ))}
        </View>
      </FooterColumn>

      <FooterColumn testID="copero-footer-col-secciones">
        <FooterHeading>SECCIONES</FooterHeading>
        {secciones?.map((link) => (
          <FooterLinkRow key={link.id} link={link} />
        ))}
      </FooterColumn>

      <FooterColumn testID="copero-footer-col-destacado">
        <FooterHeading>DESTACADO</FooterHeading>
        {destacado?.map((link) => (
          <FooterLinkRow key={link.id} link={link} />
        ))}
      </FooterColumn>

      <FooterColumn testID="copero-footer-col-legal">
        <FooterHeading>LEGAL Y CONTACTO</FooterHeading>
        {legal?.map((link) => (
          <FooterLinkRow key={link.id} link={link} />
        ))}
      </FooterColumn>
    </View>
  );
}

function FooterColumn({
  children,
  testID,
  style,
}: {
  children: React.ReactNode;
  testID?: string;
  style?: ViewStyle;
}) {
  const { spacing } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        minWidth: 160,
        paddingRight: spacing[4],
        marginBottom: spacing[4],
        ...style,
      }}
    >
      {children}
    </View>
  );
}

function FooterWordmark({ text }: { text: string }) {
  const { colors, fontSize, fontWeight, fontFamily } = useTheme();
  return (
    <Text
      style={{
        color: colors.text,
        fontFamily: fontFamily.display,
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        letterSpacing: 0.2,
      }}
    >
      {text}
    </Text>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  const { spacing, fontSize, fontFamily, fontWeight, colors } = useTheme();
  return (
    <Text
      style={{
        color: colors.textMuted,
        fontFamily: fontFamily.display,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: spacing[3],
      }}
    >
      {children}
    </Text>
  );
}

function FooterLinkRow({ link }: { link: FooterLink }) {
  const { spacing, fontSize, fontFamily, fontWeight, colors } = useTheme();
  const interactiveProps = link.onPress
    ? {
        onPress: link.onPress,
        accessibilityRole: 'button' as const,
        accessibilityLabel: link.label,
      }
    : { accessible: false };

  return (
    <Pressable
      {...interactiveProps}
      testID={`copero-footer-link-${link.id}`}
      hitSlop={spacing[1]}
      style={() => ({
        marginBottom: spacing[2],
        ...(Platform.OS === 'web'
          ? ({ cursor: link.onPress ? 'pointer' : 'auto' } as const)
          : null),
      })}
    >
      {({ pressed }) => (
        <Text
          style={{
            color: pressed ? colors.textStrong : colors.textMuted,
            fontFamily: fontFamily.body,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.regular,
            ...(Platform.OS === 'web' ? { textDecorationLine: 'none' as const } : null),
          }}
        >
          {link.label}
        </Text>
      )}
    </Pressable>
  );
}

function SocialButton({ social }: { social: FooterSocial }) {
  const { colors, spacing, borderWidth } = useTheme();
  const a11yLabel = SOCIAL_A11Y_LABEL[social.id];
  return (
    <Pressable
      onPress={social.onPress}
      disabled={!social.onPress}
      accessibilityRole={social.onPress ? 'button' : undefined}
      accessibilityLabel={a11yLabel}
      testID={`copero-footer-social-${social.id}`}
      hitSlop={spacing[2]}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 9999,
        borderWidth: borderWidth.hairline,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing[2],
        opacity: pressed && social.onPress ? 0.7 : 1,
        ...(Platform.OS === 'web'
          ? ({ cursor: social.onPress ? 'pointer' : 'auto' } as const)
          : null),
      })}
    >
      <Text
        accessible={false}
        style={{
          color: colors.text,
          fontFamily: 'JetBrainsMono',
          fontSize: 16,
        }}
      >
        {social.icon}
      </Text>
    </Pressable>
  );
}

const SOCIAL_A11Y_LABEL: Record<FooterSocial['id'], string> = {
  x: 'X (Twitter)',
  instagram: 'Instagram',
  cafecito: 'Cafecito',
};

function ThemeToggle({
  mode,
  onChange,
  colors,
  spacing,
  borderWidth,
}: {
  mode?: 'light' | 'dark' | 'copero';
  onChange?: (next: 'light' | 'dark' | 'copero') => void;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  borderWidth: ReturnType<typeof useTheme>['borderWidth'];
}) {
  const order: ('light' | 'dark' | 'copero')[] = ['light', 'dark', 'copero'];
  const icons: Record<'light' | 'dark' | 'copero', string> = {
    light: '☀',
    dark: '🖥',
    copero: '🌙',
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
      }}
      accessibilityRole={onChange ? 'radiogroup' : undefined}
      accessibilityLabel="Tema"
      testID="copero-footer-theme-toggle"
    >
      {order.map((opt) => {
        const active = mode === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange?.(opt)}
            disabled={!onChange}
            accessibilityRole={onChange ? 'radio' : undefined}
            accessibilityLabel={`Tema ${opt}${active ? ', activo' : ''}`}
            accessibilityState={onChange ? { selected: active } : undefined}
            testID={`copero-footer-theme-${opt}`}
            hitSlop={spacing[2]}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 9999,
              borderWidth: active ? borderWidth.thick : borderWidth.hairline,
              borderColor: active ? colors.textStrong : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: spacing[2],
              opacity: pressed && onChange ? 0.7 : 1,
              ...(Platform.OS === 'web'
                ? ({ cursor: onChange ? 'pointer' : 'auto' } as const)
                : null),
            })}
          >
            <Text
              accessible={false}
              style={{
                color: active ? colors.textStrong : colors.textMuted,
                fontSize: 14,
              }}
            >
              {icons[opt]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const defaultSocials: FooterSocial[] = [
  { id: 'x', icon: '𝕏' },
  { id: 'instagram', icon: '◉' },
  { id: 'cafecito', icon: '☕' },
];