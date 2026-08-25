import React from 'react';
import { Linking, Platform, Pressable, Text, View, AccessibilityRole } from 'react-native';
import { useTheme } from '../useTheme';

/**
 * SiteFooter — MGC-657.
 *
 * Port del `SiteFooter.tsx` (30 LOC) de `kiya0908/copero`. Cubre el Gap P1
 * del audit visual `MGC-646 copero.top` vs `copero.mgcstudios.app`.
 *
 * Estructura (single-row inline):
 * - Copyright dinámico a la izquierda: `© <año> Copero · Proyecto independiente`.
 * - Links a la derecha: Privacy · Terms · Contacto · GitHub.
 *
 * Las rutas internas (`/privacidad`, `/terminos`) no existen todavía
 * en este bundle; el `onPress` de los links internos abre la URL con
 * `Linking.openURL` para mantener compat nativa + web sin acoplar
 * expo-router. Cuando esas rutas existan, se reemplaza por
 * `<Link href>` de expo-router.
 *
 * GitHub es link externo (`https://github.com/mgcstudios/copero`).
 * Contacto es `mailto:`.
 *
 * i18n: el locale-context (`useLocale()`) vive en `src/i18n/` y aún no
 * está mergeado en main. SiteFooter queda self-contained con copy en
 * `es-AR` (idioma del sitio). Retrofit a i18n cuando MGC-653 PR mergee.
 *
 * A11y:
 * - Contenedor `<footer>` con `accessibilityLabel` + `accessibilityHint`
 *   localized (RN 0.86.2 YA NO acepta `accessibilityRole="contentinfo"` —
 *   lanza IllegalArgumentException; ticket MGC-726). Antes se casteaba
 *   `'contentinfo' as AccessibilityRole`, pero `ReactAccessibilityDelegate.kt:511`
 *   ahora rechaza el valor. Reemplazamos por landmark semántico vía
 *   label/hint + agrupamiento por swipe de TalkBack/VoiceOver.
 * - `<nav>` con `accessibilityRole="navigation"` + label localizado
 *   (también casteado).
 * - Cada link: `accessibilityRole="link"` + label explícito.
 * - Texto del copyright se marca `accessibilityRole="text"` para que
 *   screen readers lo lean agrupado.
 *
 * Sin CLS: el contenedor tiene `minHeight` reservado para que el texto
 * no genere layout shift al cargar fuentes (Inter ya está bundleada en
 * MGC-555 PR1, pero el primer render del web bundle puede tardar).
 */
const NAVIGATION_ROLE = 'navigation' as AccessibilityRole;

const FOOTER_LINKS = [
  { id: 'privacy', label: 'Privacidad', href: '/privacidad' },
  { id: 'terms', label: 'Términos', href: '/terminos' },
  { id: 'contact', label: 'Contacto', href: 'mailto:contacto@copero.app' },
  { id: 'github', label: 'GitHub', href: 'https://github.com/mgcstudios/copero' },
] as const;

export type SiteFooterProps = {
  testID?: string;
};

export function SiteFooter({ testID = 'copero-site-footer' }: SiteFooterProps) {
  const { colors, spacing, fontSize, fontWeight, fontFamily, borderWidth } = useTheme();
  const year = new Date().getFullYear();

  return (
    <View
      testID={testID}
      accessibilityLabel="Pie de página del sitio"
      accessibilityHint="Información legal y enlaces de navegación secundarios"
      style={{
        backgroundColor: colors.bg,
        borderTopWidth: borderWidth.hairline,
        borderTopColor: colors.border,
        paddingHorizontal: spacing[5],
        paddingVertical: spacing[5],
        minHeight: 64,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing[3],
      }}
    >
      <Text
        accessibilityRole="text"
        style={{
          color: colors.textMuted,
          fontFamily: fontFamily.body,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.regular,
          flexShrink: 1,
        }}
      >
        © {year} Copero · Proyecto independiente
      </Text>
      <View
        accessibilityRole={NAVIGATION_ROLE}
        accessibilityLabel="Navegación del pie de página"
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing[4],
          ...(Platform.OS === 'web' ? ({ display: 'flex' } as const) : null),
        }}
      >
        {FOOTER_LINKS.map((link) => (
          <FooterLink key={link.id} link={link} />
        ))}
      </View>
    </View>
  );
}

type FooterLinkItem = (typeof FOOTER_LINKS)[number];

function FooterLink({ link }: { link: FooterLinkItem }) {
  const { colors, spacing, fontSize, fontFamily, fontWeight } = useTheme();
  const handlePress = () => {
    void Linking.openURL(link.href);
  };
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="link"
      accessibilityLabel={link.label}
      testID={`copero-site-footer-link-${link.id}`}
      hitSlop={spacing[2]}
      style={({ pressed }) => ({
        paddingVertical: spacing[1],
        opacity: pressed ? 0.7 : 1,
        ...(Platform.OS === 'web'
          ? ({ cursor: 'pointer', textDecorationLine: 'none' } as const)
          : null),
      })}
    >
      {({ pressed }) => (
        <Text
          style={{
            color: pressed ? colors.textStrong : colors.textMuted,
            fontFamily: fontFamily.body,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.regular,
          }}
        >
          {link.label}
        </Text>
      )}
    </Pressable>
  );
}