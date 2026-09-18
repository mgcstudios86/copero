/**
 * MGC-475 — Detalle del jugador ofertado.
 *
 * Pantalla 2/3 del flow mercado-de-pases. Stats, valor de mercado, club de
 * origen, historial resumido, y CTA principal `Ofertar X` que abre el
 * sheet de confirmación.
 *
 * Estado de error:
 *  - `wireframe 12a-detalle-jugador-vendido` — el jugador fue vendido en
 *    background (pool refrescado por otro flow / refresh manual). CTA
 *    único "Volver al mercado".
 *
 * Navegación:
 *  - `Ofertar X` → /mercado/confirmacion?amount=X
 *  - Back → /mercado/lista
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { ClubCrest } from '@/design/components/ClubCrest';
import { useCareerStore } from '@/shared/store/careerStore';
import { useLocale } from '@/i18n/locale-context';
import { POSITION_LABEL } from '@/features/career/positions';
import { ACADEMY_CLUBS } from '@/features/career/clubs';
import { findMarketPlayer } from '@/features/career/market';

const eur = (n: number) => `€${n.toLocaleString('es-AR')}M`;

export default function DetalleJugadorScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const { t } = useLocale();
  const params = useLocalSearchParams<{ playerId?: string }>();

  const marketState = useCareerStore((s) => s.marketState);
  const profile = useCareerStore((s) => s.profile);
  const proposePurchase = useCareerStore((s) => s.proposePurchase);

  const playerId = typeof params.playerId === 'string' ? params.playerId : '';
  const player = useMemo(
    () => (marketState?.pool ? findMarketPlayer(marketState.pool, playerId) : null),
    [marketState?.pool, playerId],
  );

  // Auto-crear la offer si llegamos sin una pre-existente. Esto cubre el
  // caso de deep-link (futuro E2E) y el flujo normal: la pantalla abre
  // con el snapshot del jugador tomado al tap de la lista.
  useEffect(() => {
    if (player && (!marketState?.pendingOffer || marketState.pendingOffer.playerId !== player.id)) {
      void proposePurchase(player.id, player.value);
    }
  }, [player, marketState?.pendingOffer, proposePurchase]);

  const onOfertar = useCallback(() => {
    if (!player) return;
    router.push({
      pathname: '/simulador-carrera/mercado/confirmacion',
      params: { playerId: player.id, amount: String(player.value) },
    });
  }, [player, router]);

  const onBack = useCallback(() => {
    router.replace('/simulador-carrera/mercado/lista');
  }, [router]);

  // Branch vendido en background (12a).
  if (!player) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.bg }]}
        edges={['bottom']}
      >
        <View
          style={{
            flex: 1,
            padding: spacing[4],
            justifyContent: 'center',
            alignItems: 'center',
            gap: spacing[4],
          }}
          testID="mercado-detalle-sold"
        >
          <Text
            style={{
              color: colors.danger,
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
          >
            {t('mercado.soldTitle')}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.base,
              textAlign: 'center',
            }}
          >
            {t('mercado.soldBody')}
          </Text>
          <Button
            label={t('mercado.backToList')}
            onPress={onBack}
            variant="primary"
            fullWidth
            testID="mercado-detalle-sold-back"
          />
        </View>
      </SafeAreaView>
    );
  }

  const club = ACADEMY_CLUBS.find((c) => c.id === player.fromClub.id);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { gap: spacing[4], padding: spacing[4] },
        ]}
        testID="mercado-detalle-screen"
      >
        {/* Hero */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[4],
            gap: spacing[3],
            alignItems: 'center',
          }}
        >
          {club ? <ClubCrest club={club} size={64} /> : null}
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
          >
            {player.name}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.base,
            }}
          >
            {POSITION_LABEL[player.position]} · {player.age}a
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
            }}
          >
            OVR {player.ovr}
          </Text>
        </View>

        {/* Stats */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[4],
            gap: spacing[3],
          }}
        >
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('mercado.seasonStats')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
            <Stat label={t('mercado.apps')} value={`${player.seasonApps}`} />
            <Stat label={t('mercado.goals')} value={`${player.seasonGoals}`} />
            <Stat label={t('mercado.ast')} value={`${player.seasonAst}`} />
          </View>
        </View>

        {/* Valor + club origen */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[4],
            gap: spacing[2],
          }}
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            {t('mercado.value')}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
            }}
            testID="mercado-detalle-value"
          >
            {eur(player.value)}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.sm,
            }}
          >
            {`${t('mercado.from')} ${player.fromClub.name}`}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.xs,
            }}
          >
            {`${t('mercado.budgetLabel')}: ${eur(profile.clubPresupuesto)}`}
          </Text>
        </View>
      </ScrollView>

      <View
        style={{
          padding: spacing[4],
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          gap: spacing[2],
        }}
      >
        <Button
          label={t('mercado.offer', { amount: eur(player.value) })}
          onPress={onOfertar}
          variant="primary"
          size="lg"
          fullWidth
          disabled={profile.clubPresupuesto < player.value}
          testID="mercado-detalle-ofertar"
          hitSlop={{ top: 44, left: 44, right: 44, bottom: 44 }}
        />
        <Button
          label={t('mercado.back')}
          onPress={onBack}
          variant="secondary"
          fullWidth
          testID="mercado-detalle-back"
        />
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View
      style={{
        flexBasis: '30%',
        flexGrow: 1,
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[3],
        borderRadius: 6,
        backgroundColor: colors.surface2,
        gap: spacing[1],
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 12,
          fontWeight: fontWeight.bold,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.textStrong,
          fontSize: fontSize.md,
          fontWeight: fontWeight.bold,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
});