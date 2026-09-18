/**
 * MGC-475 — Sheet de confirmación de traspaso.
 *
 * Pantalla 3/3 del flow mercado-de-pases. Modal/resumen con monto, club
 * origen/destino, balance resultante. CTAs `Confirmar` y `Cancelar`.
 *
 * Decisión IA:
 *  - Al confirmar, `confirmPurchase` corre la IA (RNG determinista). La
 *    IA puede:
 *      a) Aceptar → pool drenado, presupuesto actualizado, navega a home
 *      b) Rechazar contrapropuesta → pantalla 13a error, CTA re-ofertar o volver
 *      c) Jugador vendido en background → cae al detalle-vendido (12a)
 *
 * Navegación:
 *  - Confirmar + aceptado  → /dashboard con toast/sheet de éxito
 *  - Cancelar              → /mercado/lista
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { ClubCrest } from '@/design/components/ClubCrest';
import { useCareerStore } from '@/shared/store/careerStore';
import { useLocale } from '@/i18n/locale-context';
import { ACADEMY_CLUBS } from '@/features/career/clubs';
import { findMarketPlayer } from '@/features/career/market';

const eur = (n: number) => `€${n.toLocaleString('es-AR')}M`;

type Outcome =
  | { kind: 'idle' }
  | { kind: 'success'; playerName: string; paid: number; newBudget: number }
  | { kind: 'rejected' }
  | { kind: 'unavailable' }
  | { kind: 'insufficient' };

export default function ConfirmacionTraspasoScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const { t } = useLocale();
  const params = useLocalSearchParams<{ playerId?: string }>();

  const marketState = useCareerStore((s) => s.marketState);
  const profile = useCareerStore((s) => s.profile);
  const proposePurchase = useCareerStore((s) => s.proposePurchase);
  const confirmPurchase = useCareerStore((s) => s.confirmPurchase);
  const cancelPurchase = useCareerStore((s) => s.cancelPurchase);

  const playerId = typeof params.playerId === 'string' ? params.playerId : '';
  const player = marketState?.pool ? findMarketPlayer(marketState.pool, playerId) : null;

  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);

  // Si llegamos al sheet sin pendingOffer, lo creamos con el valor actual.
  useEffect(() => {
    if (player && (!marketState?.pendingOffer || marketState.pendingOffer.playerId !== player.id)) {
      void proposePurchase(player.id, player.value);
    }
  }, [player, marketState?.pendingOffer, proposePurchase]);

  const onConfirm = useCallback(async () => {
    if (busy || !player) return;
    setBusy(true);
    try {
      const result = await confirmPurchase();
      if (result.ok) {
        setOutcome({
          kind: 'success',
          playerName: player.name,
          paid: marketState?.pendingOffer?.amount ?? player.value,
          newBudget: profile.clubPresupuesto - (marketState?.pendingOffer?.amount ?? player.value),
        });
      } else {
        if (result.reason === 'ia_rejected') setOutcome({ kind: 'rejected' });
        else if (result.reason === 'player_unavailable') setOutcome({ kind: 'unavailable' });
        else setOutcome({ kind: 'insufficient' });
      }
    } finally {
      setBusy(false);
    }
  }, [busy, player, confirmPurchase, marketState?.pendingOffer, profile.clubPresupuesto]);

  const onCancel = useCallback(async () => {
    if (busy) return;
    await cancelPurchase();
    router.replace('/simulador-carrera/mercado/lista');
  }, [busy, cancelPurchase, router]);

  const onDone = useCallback(() => {
    router.replace('/simulador-carrera/dashboard');
  }, [router]);

  const onRetry = useCallback(() => {
    setOutcome({ kind: 'idle' });
    router.replace('/simulador-carrera/mercado/lista');
  }, [router]);

  // ── Branch: success ───────────────────────────────────────────────
  if (outcome.kind === 'success') {
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
            gap: spacing[4],
          }}
          testID="mercado-confirm-success"
        >
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
          >
            {t('mercado.successTitle')}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.base,
              textAlign: 'center',
            }}
          >
            {t('mercado.successBody', {
              name: outcome.playerName,
              paid: eur(outcome.paid),
              balance: eur(outcome.newBudget),
            })}
          </Text>
          <Button
            label={t('mercado.done')}
            onPress={onDone}
            variant="primary"
            size="lg"
            fullWidth
            testID="mercado-confirm-success-done"
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Branch: error IA (13a) ─────────────────────────────────────────
  if (outcome.kind === 'rejected' || outcome.kind === 'unavailable' || outcome.kind === 'insufficient') {
    const errorKey =
      outcome.kind === 'rejected'
        ? 'mercado.iaRejected'
        : outcome.kind === 'unavailable'
        ? 'mercado.soldTitle'
        : 'mercado.noBudgetTitle';
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
            gap: spacing[4],
          }}
          testID={`mercado-confirm-error-${outcome.kind}`}
        >
          <Text
            style={{
              color: colors.danger,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
          >
            {t(errorKey)}
          </Text>
          <Button
            label={t('mercado.retry')}
            onPress={onRetry}
            variant="primary"
            fullWidth
            testID="mercado-confirm-error-retry"
          />
          <Button
            label={t('mercado.back')}
            onPress={onDone}
            variant="secondary"
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Branch: idle (mostrar resumen) ─────────────────────────────────
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
          testID="mercado-confirm-no-player"
        >
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
            {t('mercado.soldBody')}
          </Text>
          <Button
            label={t('mercado.backToList')}
            onPress={onRetry}
            variant="primary"
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  const buyerClub = profile.club;
  const amount = marketState?.pendingOffer?.amount ?? player.value;
  const newBudget = profile.clubPresupuesto - amount;
  const buyerClubDef = buyerClub
    ? ACADEMY_CLUBS.find((c) => c.id === buyerClub.id)
    : undefined;
  const sellerClubDef = ACADEMY_CLUBS.find((c) => c.id === player.fromClub.id);

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
        testID="mercado-confirm-screen"
      >
        {/* Hero */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[4],
            gap: spacing[2],
            alignItems: 'center',
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
            {t('mercado.confirmEyebrow')}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.xl,
              fontWeight: fontWeight.bold,
            }}
          >
            {player.name}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
            {t('mercado.value')}: {eur(amount)}
          </Text>
        </View>

        {/* Trayecto: origen → destino */}
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
          <Party
            label={t('mercado.from')}
            club={sellerClubDef}
            name={player.fromClub.name}
          />
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginVertical: spacing[1],
            }}
          />
          <Party
            label={t('mercado.to')}
            club={buyerClubDef}
            name={buyerClub?.name ?? t('mercado.unknownClub')}
          />
        </View>

        {/* Balance resultante */}
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
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {t('mercado.currentBudget')}
          </Text>
          <Text style={{ color: colors.textStrong, fontSize: fontSize.lg }}>
            {eur(profile.clubPresupuesto)}
          </Text>
          <Text
            style={{
              color: newBudget >= 0 ? colors.success : colors.danger,
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
            }}
            testID="mercado-confirm-new-budget"
          >
            {`${t('mercado.afterBuy')}: ${eur(newBudget)}`}
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
          label={t('mercado.confirm')}
          onPress={onConfirm}
          variant="primary"
          size="lg"
          fullWidth
          disabled={busy || newBudget < 0}
          testID="mercado-confirm-submit"
          hitSlop={{ top: 44, left: 44, right: 44, bottom: 44 }}
        />
        <Button
          label={t('mercado.cancel')}
          onPress={onCancel}
          variant="secondary"
          fullWidth
          disabled={busy}
          testID="mercado-confirm-cancel"
        />
      </View>
    </SafeAreaView>
  );
}

function Party({
  label,
  club,
  name,
}: {
  label: string;
  club: ReturnType<typeof ACADEMY_CLUBS.find>;
  name: string;
}) {
  const { colors, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
      {club ? <ClubCrest club={club} size={36} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
          {label}
        </Text>
        <Text
          style={{
            color: colors.textStrong,
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
          }}
        >
          {name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
});