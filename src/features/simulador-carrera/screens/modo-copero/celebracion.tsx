/**
 * src/features/simulador-carrera/screens/modo-copero/celebracion.tsx — MGC-490
 *
 * Screen 3/3 del flow modo-copero: modal bottom-sheet al ganar la copa.
 *
 * Spec visual: docs/handoffs/modo-copero.md §Pantalla 3.
 *   - Hero: 🏆 grande + "CAMPEÓN"
 *   - List premios: €5M, +25 moral, +150 prestigio, clasificación internacional
 *
 * Regla explícita del handoff: el celebration **NO** usa Alert.alert nativo;
 * siempre este modal-bottom-sheet para mantener la consistencia visual.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { clearSlot, getSlot, subscribeSlot, type CoperoSlot } from '@/features/copero/slot';

type Prize = {
  label: string;
  value: string;
  variant: 'success' | 'primary' | 'warning';
};

const PRIZES: Prize[] = [
  { label: 'Premio económico', value: '€5M', variant: 'success' },
  { label: 'Moral del equipo', value: '+25', variant: 'primary' },
  { label: 'Prestigio', value: '+150', variant: 'primary' },
  { label: 'Clasificación internacional', value: 'Copa Sudamericana', variant: 'warning' },
];

export default function CelebracionScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize } = useTheme();
  const [slot, setSlot] = useState<CoperoSlot | null>(getSlot());

  useEffect(() => subscribeSlot(setSlot), []);

  const onDismiss = useCallback(() => {
    clearSlot();
    router.replace('/simulador-carrera/dashboard' as never);
  }, [router]);

  const champion = slot?.champion ?? 'TU CLUB';
  const isWon = slot?.status === 'won';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[5] }}>
        <Pressable onPress={onDismiss} testID="celebracion-backdrop">
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            Toque fuera para volver
          </Text>
        </Pressable>
      </View>

      <Modal visible animationType="slide" transparent onRequestClose={onDismiss}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={onDismiss}
        >
          <Pressable
            onPress={() => {
              /* prevent dismiss on inner tap */
            }}
            style={{
              width: '100%',
              maxWidth: 430,
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xxl,
              borderTopRightRadius: radii.xxl,
              padding: spacing[5],
              paddingBottom: Math.max(spacing[5] as number, 24),
              gap: spacing[4],
            }}
          >
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

            <View style={{ alignItems: 'center', gap: spacing[2] }}>
              <Text style={{ fontSize: 72 }}>🏆</Text>
              <View
                style={{
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[1],
                  borderRadius: 999,
                  backgroundColor: colors.primarySoft,
                  borderWidth: 1,
                  borderColor: colors.primary,
                }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: fontSize.xs,
                    fontWeight: '700',
                    letterSpacing: 1.5,
                  }}
                >
                  CAMPEÓN
                </Text>
              </View>
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize['2xl'],
                  fontWeight: '700',
                  textAlign: 'center',
                }}
              >
                {isWon ? `¡${champion} campeón de la Copa!` : 'Esperando resultado…'}
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: fontSize.sm,
                  textAlign: 'center',
                }}
              >
                Premios desbloqueados al cerrar el torneo.
              </Text>
            </View>

            <View style={{ gap: spacing[2] }}>
              {PRIZES.map((p) => (
                <PrizeRow key={p.label} prize={p} />
              ))}
            </View>

            <Button label="Volver al inicio" onPress={onDismiss} variant="primary" fullWidth />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function PrizeRow({ prize }: { prize: Prize }) {
  const { colors, radii, spacing, fontSize } = useTheme();
  const chipBg =
    prize.variant === 'success'
      ? colors.successSoft
      : prize.variant === 'warning'
      ? colors.warningSoft
      : colors.primarySoft;
  const chipFg =
    prize.variant === 'success'
      ? colors.success
      : prize.variant === 'warning'
      ? colors.warning
      : colors.primary;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing[3],
        borderRadius: radii.md,
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.borderStrong,
      }}
    >
      <Text style={{ color: colors.text, fontSize: fontSize.sm }}>{prize.label}</Text>
      <View
        style={{
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[1],
          borderRadius: 999,
          backgroundColor: chipBg,
          borderWidth: 1,
          borderColor: chipFg,
        }}
      >
        <Text style={{ color: chipFg, fontSize: fontSize.xs, fontWeight: '700' }}>{prize.value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
  },
});
