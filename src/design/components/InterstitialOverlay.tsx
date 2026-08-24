import React from 'react';
import { Modal, Platform, Pressable, Text, View, AccessibilityRole } from 'react-native';
import { useTheme } from '../useTheme';
import { useReducedMotion } from '../useReducedMotion';

/**
 * `dialog` es un rol ARIA estándar pero NO está en la enum `AccessibilityRole`
 * de React Native: pasarlo a un View nativo lanza
 * `JSApplicationIllegalArgumentException: Invalid accessibility role value: dialog`
 * en Android con TalkBack (MGC-500). En Android usamos `none` + el flag
 * `accessibilityViewIsModal` para mantener el comportamiento modal a nivel
 * accesibilidad sin que TalkBack crashee.
 */
const MODAL_ROLE: AccessibilityRole =
  Platform.OS === 'android' ? 'none' : ('dialog' as AccessibilityRole);

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  ctaLabel?: string;
  testID?: string;
};

/**
 * Overlay modal que se dispara al terminar un copero. A11y:
 * - role="dialog" (el Modal nativo de RN gestiona aria-modal de plataforma)
 * - título como accessibilityLabel principal
 * - botón de cierre como botón accesible
 * - respeta prefers-reduced-motion (sin animación de entrada)
 *
 * En el futuro el contenido central puede ser un anuncio intersticial real
 * (AdMob Interstitial / AdSense). Hoy muestra un cierre de ronda con CTA.
 */
export function InterstitialOverlay({
  visible,
  onClose,
  title = 'Copero terminado',
  message = '¡Buena ronda! ¿Otra?',
  ctaLabel = 'Jugar de nuevo',
  testID,
}: Props) {
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily } = useTheme();
  const reducedMotion = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar overlay"
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[5],
        }}
      >
        <View
          accessibilityRole={MODAL_ROLE}
          accessibilityViewIsModal
          accessibilityLabel={title}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            padding: spacing[6],
            width: '100%',
            maxWidth: 420,
            alignItems: 'center',
            gap: spacing[4],
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontFamily: fontFamily.display,
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: colors.text,
              fontSize: fontSize.base,
              textAlign: 'center',
            }}
          >
            {message}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            onPress={onClose}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              paddingVertical: spacing[3],
              paddingHorizontal: spacing[5],
              borderRadius: radii.md,
              minHeight: 48,
              minWidth: 200,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: colors.textOnPrimary,
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
              }}
            >
              {ctaLabel}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
