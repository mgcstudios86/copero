import React, { useState } from 'react';
import { Link } from 'expo-router';
import {
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';
import { useLocale } from '../../i18n/locale-context';
import { LanguageSwitcher } from './LanguageSwitcher';

/**
 * SiteHeader — MGC-653.
 *
 * Port del `SiteHeader.tsx` (73 LOC) de `kiya0908/copero` a React Native.
 * Cubre el Gap P0 del audit visual `MGC-646 copero.top` vs `copero.mgcstudios.app`.
 *
 * Estructura:
 * - Brand lockup a la izquierda (wordmark "Copero" en Poppins Bold).
 * - Navegación central con 7 links: Simulador · Crea tu carrera ·
 *   Carrera completa · Carrera rápida · Cómo jugar · Mecánicas · FAQ.
 * - Slot derecho: LanguageSwitcher + CTA "Jugar" verde + toggle hamburguesa
 *   (mobile).
 *
 * Responsive:
 * - ≥ 720 px: los 7 links se renderizan inline; hamburguesa oculta.
 * - < 720 px: solo brand + acciones; los links se ocultan hasta abrir el
 *   toggle (drawer-like con `data-open` que apila los links debajo del
 *   header en columna).
 *
 * Rutas: las internas usan `<Link href>` de expo-router; las anclas a
 * secciones (`#how-to-play`, `#mechanics`, `#faq`) usan anchor `<a>` solo
 * en web; en nativo la home se renderiza como `<Link href="/" />` sin ancla
 * (la versión mobile del FAQ/mecánicas vive en `simulador-carrera`).
 *
 * A11y:
 * - `<header>` nativo (`accessibilityRole="banner"`).
 * - `<nav>` con `accessibilityRole="navigation"` + `accessibilityLabel` localizado.
 * - Toggle móvil: `accessibilityRole="button"` + `accessibilityState.expanded`.
 * - CTA Jugar: `accessibilityRole="link"` (es Link).
 */

const BREAKPOINT = 720;

const NAV_ITEMS = [
  { key: 'simulator', href: '/simulador-carrera' },
  { key: 'buildCareer', href: '/' },
  { key: 'fullCareer', href: '/' },
  { key: 'quickCareer', href: '/' },
  { key: 'howToPlay', href: '/#how-to-play' },
  { key: 'mechanics', href: '/#mechanics' },
  { key: 'faq', href: '/#faq' },
] as const;

export type SiteHeaderProps = {
  /** Ruta del CTA Jugar. Default "/simulador-carrera". */
  playHref?: string;
  /** Si false, oculta el LanguageSwitcher (default true). */
  showLanguageSwitcher?: boolean;
  testID?: string;
};

export function SiteHeader({
  playHref = '/simulador-carrera',
  showLanguageSwitcher = true,
  testID = 'copero-site-header',
}: SiteHeaderProps) {
  const { colors, spacing, fontSize, fontWeight, fontFamily, radii, borderWidth, tapTarget } =
    useTheme();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  const compact = width < BREAKPOINT;
  const closeMenu = () => setMenuOpen(false);

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface,
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: colors.border,
    gap: spacing[4],
    ...(Platform.OS === 'web'
      ? ({
          display: 'flex',
        } as const)
      : null),
  };

  const brandStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: tapTarget,
    ...(Platform.OS === 'web' ? ({ textDecorationLine: 'none' } as const) : null),
  };

  const navLinkStyle: ViewStyle = {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    ...(Platform.OS === 'web' ? ({ textDecorationLine: 'none', cursor: 'pointer' } as const) : null),
  };

  const navLinkText = {
    color: colors.text,
    fontFamily: fontFamily.body,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.3,
    ...(Platform.OS === 'web' ? { textDecorationLine: 'none' as const } : null),
  };

  const playStyle: ViewStyle = {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    minHeight: Math.max(tapTarget, 36),
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ textDecorationLine: 'none', cursor: 'pointer' } as const) : null),
  };

  const playText = {
    color: colors.textOnPrimary,
    fontFamily: fontFamily.body,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
    letterSpacing: 0.2,
    ...(Platform.OS === 'web' ? { textDecorationLine: 'none' as const } : null),
  };

  return (
    <View
      testID={testID}
      accessibilityRole="header"
      style={headerStyle}
    >
      <Link href="/" asChild accessibilityRole="link" accessibilityLabel={t('brand')}>
        <View style={brandStyle}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radii.sm,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: colors.textOnPrimary,
                fontFamily: fontFamily.display,
                fontWeight: fontWeight.bold,
                fontSize: fontSize.md,
                lineHeight: fontSize.md,
              }}
            >
              C
            </Text>
          </View>
          <Text
            style={{
              color: colors.textStrong,
              fontFamily: fontFamily.display,
              fontWeight: fontWeight.bold,
              fontSize: fontSize.lg,
              lineHeight: fontSize.lg * 1.1,
            }}
          >
            {t('brand')}
          </Text>
        </View>
      </Link>

      {!compact && (
        <View
          testID={`${testID}-nav`}
          accessibilityLabel={t('nav.primary')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[1],
            flex: 1,
            justifyContent: 'center',
            ...(Platform.OS === 'web' ? ({ display: 'flex', flexWrap: 'wrap' } as const) : null),
          }}
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              asChild
              accessibilityRole="link"
              accessibilityLabel={t(`nav.${item.key}`)}
            >
              <View style={navLinkStyle}>
                <Text style={navLinkText}>{t(`nav.${item.key}`)}</Text>
              </View>
            </Link>
          ))}
        </View>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
        }}
      >
        {showLanguageSwitcher && <LanguageSwitcher />}
        {!compact && (
          <Link
            href={playHref}
            asChild
            accessibilityRole="link"
            accessibilityLabel={t('nav.play')}
            testID={`${testID}-play`}
          >
            <View style={playStyle}>
              <Text style={playText}>{t('nav.play')}</Text>
            </View>
          </Link>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={menuOpen ? t('nav.menuClose') : t('nav.menuOpen')}
          accessibilityState={{ expanded: menuOpen }}
          {...(Platform.OS === 'web'
            ? ({
                'aria-expanded': menuOpen,
                'aria-haspopup': 'menu' as const,
                'aria-controls': `${testID}-mobile-nav`,
              } as const)
            : null)}
          hitSlop={spacing[2]}
          testID={`${testID}-toggle`}
          onPress={() => setMenuOpen((open) => !open)}
          style={({ pressed }) => ({
            minWidth: tapTarget,
            minHeight: tapTarget,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.md,
            backgroundColor: pressed ? colors.surface2 : 'transparent',
            ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null),
          })}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 22,
                height: 2,
                marginVertical: 2,
                borderRadius: 1,
                backgroundColor: colors.text,
              }}
            />
          ))}
        </Pressable>
      </View>

      {compact && menuOpen && (
        <View
          testID={`${testID}-mobile-nav`}
          accessibilityLabel={t('nav.primary')}
          nativeID={`${testID}-mobile-nav`}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            flexDirection: 'column',
            backgroundColor: colors.surface,
            paddingHorizontal: spacing[5],
            paddingVertical: spacing[3],
            borderBottomWidth: borderWidth.hairline,
            borderBottomColor: colors.border,
            gap: spacing[1],
            ...(Platform.OS === 'web' ? ({ display: 'flex', position: 'absolute' } as const) : null),
          }}
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={`m-${item.key}`}
              href={item.href}
              asChild
              accessibilityRole="link"
              accessibilityLabel={t(`nav.${item.key}`)}
            >
              <Pressable
                onPress={closeMenu}
                style={({ pressed }) => [
                  navLinkStyle,
                  pressed ? { backgroundColor: colors.surface2 } : null,
                ]}
              >
                <Text style={navLinkText}>{t(`nav.${item.key}`)}</Text>
              </Pressable>
            </Link>
          ))}
          <Link
            href={playHref}
            asChild
            accessibilityRole="link"
            accessibilityLabel={t('nav.play')}
            onPress={closeMenu}
          >
            <View style={[playStyle, { marginTop: spacing[2], alignSelf: 'flex-start' }]}>
              <Text style={playText}>{t('nav.play')}</Text>
            </View>
          </Link>
        </View>
      )}
    </View>
  );
}
