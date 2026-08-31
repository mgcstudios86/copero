/**
 * ResetCareerButton — MGC-565. Ver detalle en commit message.
 */
import React, { useCallback } from 'react';
import { Alert, Platform, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design';
import { useCareerStore } from '@/shared/store/careerStore';
import { clearCareerSave } from '@/features/career/persistence';

/**
 * Lee el flag dev-only. MGC-578: debe ser acceso literal
 * `process.env.EXPO_PUBLIC_DEV_RESET_CARRERA` (no bracket access)
 * para que `babel-plugin-transform-inline-environment-variables`
 * de Expo inlinee el valor en built APK. Bracket access sobre
 * variable local evade el plugin y `flag` queda `undefined`.
 */
export function shouldRenderResetButton(): boolean {
  const flag = process.env.EXPO_PUBLIC_DEV_RESET_CARRERA;
  return flag === '1' || flag === 'true';
}

export function ResetCareerButton() {
  if (!shouldRenderResetButton()) return null;
  return <ResetCareerButtonInner />;
}

function ResetCareerButtonInner() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const onPress = useCallback(async () => {
    const title = 'Reset carrera (dev)';
    const body = 'Esto borra la partida guardada y vuelve a identidad.';
    const confirmLabel = 'Resetear';
    const cancelLabel = 'Cancelar';

    const doReset = async () => {
      await clearCareerSave();
      useCareerStore.getState().reset();
      router.replace('/simulador-carrera');
    };

    if (Platform.OS === 'web') {
      const w = (globalThis as { window?: { confirm?: (msg: string) => boolean } })
        .window;
      if (w?.confirm && w.confirm(`${title}\n\n${body}`)) {
        await doReset();
      }
      return;
    }

    Alert.alert(title, body, [
      { text: cancelLabel, style: 'cancel' },
      {
        text: confirmLabel,
        style: 'destructive',
        onPress: () => {
          void doReset();
        },
      },
    ]);
  }, [router]);

  return (
    <Pressable
      testID="reset-career-button-wrap"
      accessibilityRole="button"
      accessibilityLabel="Reset carrera (dev)"
      accessibilityHint="Borra la partida persistida y vuelve a identidad (solo dev)"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.danger,
        borderRadius: radii.md,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[4],
        alignItems: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        testID="btn-reset-carrera"
        style={{
          color: colors.textOnPrimary,
          fontSize: fontSize.md,
          fontWeight: fontWeight.bold,
        }}
      >
        Reset carrera (dev)
      </Text>
    </Pressable>
  );
}
