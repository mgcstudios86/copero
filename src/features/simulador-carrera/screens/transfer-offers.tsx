/**
 * MGC-1803 — TR1: WIRE TRANSFER OFFERS FIN DE TEMPORADA.
 *
 * Pantalla que materializa el `TransferState` que el motor (`engine.ts`)
 * produce al cierre de temporada. Por cada oferta muestra:
 *  - Club destino (escudo + nombre + reputación).
 *  - Rol esperado (starter/rotation).
 *  - Bono de reputación, multiplicador salarial, años de contrato.
 *
 * Decisión:
 *  - `Aceptar oferta` → `resolveTransfer(offer.id)` (muta club del jugador).
 *  - `Rechazar todas` → `resolveTransfer(null)` (fallback: club actual).
 *
 * Resolución obligatoria: mientras `transferState?.resolved === false` la
 * pantalla se muestra como modal fullscreen; al resolverse, navega al
 * hub (no se puede volver — el estado se drena). Si el veredicto es
 * `retirement` o no hay ofertas (`noOffers`), se muestra el branch
 * correspondiente y el CTA único es "Volver al hub".
 *
 * Acceptance criteria (MGC-1803):
 *  - Aparece post `advanceSeason` si `transferState.offers.length > 0`.
 *  - ≥ 2 ofertas visibles si stat overall ≥ 6.0 (lo garantiza `transfers.ts`
 *    veredicto `strong_offers` / `elite_offers`).
 *  - Decisión persistida en CareerSaveState v:2 vía `resolveTransfer`.
 *  - Walk QA ZY22G728HN PASS (delegado a child MGC-{N}-[ejecutar-QA-PR-N]).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { ClubCrest } from '@/design/components/ClubCrest';
import { useCareerStore } from '@/shared/store/careerStore';
import { useLocale } from '@/i18n/locale-context';
import { ACADEMY_CLUBS } from '@/features/career/clubs';
import type { TransferOffer, TransferState } from '@/features/career/transfers';

type Props = {
  /**
   * Hook de tests: permite inyectar `transferState` mockeado en unit tests
   * sin montar el store real. En runtime el componente lee del store.
   */
  injectedState?: TransferState | null;
};

export default function TransferOffersScreen({ injectedState }: Props) {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const { t } = useLocale();

  const profile = useCareerStore((s) => s.profile);
  const liveState = useCareerStore((s) => s.transferState);
  const resolveTransfer = useCareerStore((s) => s.resolveTransfer);
  const transferState = injectedState !== undefined ? injectedState : liveState;

  // Guard doble tap (MGC-1736 pattern): mientras la persistencia está
  // corriendo no aceptamos otra pulsación para no encolar dos
  // `resolveTransfer` consecutivos.
  const [resolving, setResolving] = useState(false);

  const verdictKey = useMemo(() => {
    if (!transferState) return 'transfers.noOffers';
    switch (transferState.verdict) {
      case 'elite_offers':
        return 'transfers.verdictElite';
      case 'strong_offers':
        return 'transfers.verdictStrong';
      case 'hold':
        return 'transfers.verdictHold';
      case 'hold_low':
        return 'transfers.verdictHoldLow';
      case 'descent_risk':
        return 'transfers.verdictDescent';
      case 'retirement':
        return 'transfers.verdictRetirement';
      default:
        return 'transfers.noOffers';
    }
  }, [transferState]);

  const offerCount = transferState?.offers.length ?? 0;
  const hasOffers = offerCount > 0;

  const onAccept = useCallback(
    async (offer: TransferOffer) => {
      if (resolving || !transferState) return;
      setResolving(true);
      try {
        await resolveTransfer(offer.id);
        // La navegación se delega al `useEffect` de watch abajo.
      } finally {
        setResolving(false);
      }
    },
    [resolving, transferState, resolveTransfer],
  );

  const onDeclineAll = useCallback(async () => {
    if (resolving || !transferState) return;
    setResolving(true);
    try {
      await resolveTransfer(null);
    } finally {
      setResolving(false);
    }
  }, [resolving, transferState, resolveTransfer]);

  // Tras resolver, navegamos al hub. Guard contra unmount (back físico).
  useEffect(() => {
    if (transferState?.resolved) {
      router.replace('/simulador-carrera/season-hub');
    }
  }, [transferState?.resolved, router]);

  if (!transferState || !profile) {
    return null;
  }

  // Sticky footer altura fija (PR-394 box-none pattern).
  const CTA_HEIGHT = 52;
  const ctaCount = hasOffers ? 2 : 1;
  const ctaFooterHeight =
    ctaCount * CTA_HEIGHT + (ctaCount - 1) * spacing[2] + spacing[2] * 2;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['bottom']}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          { gap: spacing[4], padding: spacing[4] },
        ]}
        testID="transfer-offers-screen"
      >
        {/* Eyebrow + hero */}
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
          <View
            style={{
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[2],
              borderRadius: radii.pill,
              backgroundColor: '#FBBF24',
            }}
          >
            <Text
              style={{
                color: '#0A120E',
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
              accessibilityRole="header"
            >
              {t('transfers.eyebrow')}
            </Text>
          </View>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
          >
            {t('transfers.title')}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.base,
              textAlign: 'center',
            }}
          >
            {t('transfers.subtitle')}
          </Text>
        </View>

        {/* Veredicto */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: transferState.forcedTransfer ? '#D9534F' : colors.border,
            backgroundColor: colors.surface,
            padding: spacing[4],
            gap: spacing[2],
          }}
          testID="transfer-offers-verdict"
        >
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
            }}
          >
            {t(verdictKey)}
          </Text>
          {transferState.forcedTransfer ? (
            <Text
              style={{
                color: '#D9534F',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.bold,
              }}
              accessibilityLabel={t('transfers.forcedTransfer')}
            >
              {t('transfers.forcedTransfer')}
            </Text>
          ) : null}
          {hasOffers ? (
            <Text
              style={{
                color: colors.textMuted,
                fontSize: fontSize.xs,
              }}
              accessibilityLabel={t('transfers.deadline', {
                week: transferState.decisionDeadline,
              })}
            >
              {t('transfers.deadline', { week: transferState.decisionDeadline })}
            </Text>
          ) : null}
        </View>

        {/* Lista de ofertas */}
        {hasOffers ? (
          <View
            style={{ gap: spacing[3] }}
            testID="transfer-offers-list"
            accessibilityLabel={`${offerCount} ofertas`}
          >
            {transferState.offers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                onAccept={() => onAccept(offer)}
                resolving={resolving}
              />
            ))}
          </View>
        ) : (
          <View
            style={{
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing[4],
            }}
            testID="transfer-offers-empty"
          >
            <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
              {t('transfers.noOffers')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer sticky */}
      <View
        testID="transfer-offers-cta-footer"
        collapsable={false}
        style={{
          height: ctaFooterHeight,
          flexBasis: ctaFooterHeight,
          flexGrow: 0,
          flexShrink: 0,
          gap: spacing[2],
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        }}
      >
        {hasOffers ? (
          <>
            <Button
              label={t('transfers.decline')}
              onPress={onDeclineAll}
              variant="secondary"
              size="lg"
              fullWidth
              disabled={resolving}
              accessibilityHint={t('transfers.declineHint')}
              testID="btn-transfer-offers-decline-all"
              hitSlop={{ top: 44, left: 44, right: 44, bottom: 44 }}
            />
          </>
        ) : (
          <Button
            label={t('retire.backSeason')}
            onPress={onDeclineAll}
            variant="primary"
            size="lg"
            fullWidth
            disabled={resolving}
            accessibilityHint={t('retire.backSeasonA11y')}
            testID="btn-transfer-offers-back"
            hitSlop={{ top: 44, left: 44, right: 44, bottom: 44 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function OfferCard({
  offer,
  onAccept,
  resolving,
}: {
  offer: TransferOffer;
  onAccept: () => void;
  resolving: boolean;
}) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const { t } = useLocale();

  return (
    <View
      style={{
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing[4],
        gap: spacing[3],
      }}
      testID={`transfer-offers-card-${offer.id}`}
      accessibilityLabel={`${offer.club.name} ${t('transfers.accept')}`}
    >
      {/* Header: escudo + nombre + reputación */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <ClubCrest
          club={
            ACADEMY_CLUBS.find((c) => c.id === offer.club.id) ?? {
              id: offer.club.id,
              name: offer.club.name,
              crestColor: '#1F2937',
              crestAccent: '#FBBF24',
            }
          }
          size={48}
        />
        <View style={{ flex: 1, gap: spacing[1] }}>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
            }}
          >
            {offer.club.name}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {`Rep ${offer.club.reputation ?? '—'}/5`}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: spacing[2],
            paddingVertical: spacing[1],
            borderRadius: radii.pill,
            backgroundColor:
              offer.expectedRole === 'starter' ? colors.primary : colors.surface2,
          }}
        >
          <Text
            style={{
              color:
                offer.expectedRole === 'starter'
                  ? colors.textOnPrimary
                  : colors.textMuted,
              fontSize: 10,
              fontWeight: fontWeight.bold,
              letterSpacing: 1,
            }}
          >
            {t(
              offer.expectedRole === 'starter'
                ? 'transfers.roleStarter'
                : 'transfers.roleRotation',
            )}
          </Text>
        </View>
      </View>

      {/* Stats: años / salario / reputación */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing[3],
        }}
      >
        <Stat
          label={t('transfers.offerYears')}
          value={`${offer.yearsContract}a`}
        />
        <Stat
          label={t('transfers.offerWage')}
          value={`×${offer.wageMultiplier.toFixed(2)}`}
        />
        <Stat
          label={t('transfers.offerReputation')}
          value={`+${offer.reputationDelta}`}
        />
      </View>

      {/* CTA aceptar */}
      <Button
        label={t('transfers.accept')}
        onPress={onAccept}
        variant="primary"
        fullWidth
        disabled={resolving}
        accessibilityHint={t('transfers.acceptHint')}
        testID={`btn-transfer-offers-accept-${offer.id}`}
        hitSlop={44}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors, spacing, fontSize, fontWeight } = useTheme();
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
          fontSize: 10,
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
  scroll: { flex: 1, flexShrink: 1 },
  container: {},
});
