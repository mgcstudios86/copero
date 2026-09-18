/**
 * MGC-475 — Lista de jugadores en el mercado.
 *
 * Pantalla 1/3 del flow mercado-de-pases. Pool filtrable (posición, precio
 * máximo, edad máxima, club de origen). Cada card muestra: nombre, posición,
 * edad, OVR, valor, club origen, y CTA `Ofertar` que abre el detalle del
 * jugador con la oferta inicial = valor de mercado.
 *
 * Estados:
 *  - `idle`           — mercado no abierto (CTA "Abrir mercado")
 *  - `open` + pool    — listado normal
 *  - `open` + empty   — wireframe 11a-lista-jugadores-empty (sin jugadores)
 *  - `no_budget`      — wireframe 11b (presupuesto <= 0)
 *
 * Navegación:
 *  - Tap en card → /mercado/detalle?playerId=…&amount=…
 *  - Back → /dashboard
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { ClubCrest } from '@/design/components/ClubCrest';
import { useCareerStore } from '@/shared/store/careerStore';
import { useLocale } from '@/i18n/locale-context';
import { POSITION_LABEL } from '@/features/career/positions';
import { ACADEMY_CLUBS } from '@/features/career/clubs';
import {
  filterMarketPool,
  type FilterCriteria,
  type MarketPlayer,
} from '@/features/career/market';
import type { Position } from '@/types/career';

const eur = (n: number) => `€${n.toLocaleString('es-AR')}M`;

export default function ListaJugadoresScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const { t } = useLocale();

  const marketState = useCareerStore((s) => s.marketState);
  const clubPresupuesto = useCareerStore((s) => s.profile.clubPresupuesto);
  const openMarket = useCareerStore((s) => s.openMarket);
  const proposePurchase = useCareerStore((s) => s.proposePurchase);

  const [position, setPosition] = useState<Position | null>(null);
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [maxAge, setMaxAge] = useState<string>('');

  // Lazy-open al primer mount: la pantalla no abre mercado hasta que el
  // usuario entra (cumple "manual desde Dashboard" del scope MGC-475).
  useEffect(() => {
    if (!marketState || marketState.season !== useCareerStore.getState().profile.season) {
      void openMarket();
    }
  }, [openMarket, marketState]);

  // pool: useMemo para que la identidad del array sea estable entre renders
  // cuando `marketState.pool` no cambia. Sin esto, `pool` se reasigna en
  // cada render y las deps del useMemo de `filtered` invalidan el cache
  // constantemente.
  const pool: MarketPlayer[] = useMemo(
    () => marketState?.pool ?? [],
    [marketState?.pool],
  );
  const filtered = useMemo(() => {
    const criteria: FilterCriteria = {};
    if (position) criteria.position = position;
    if (maxPrice.trim() !== '') {
      const v = parseInt(maxPrice, 10);
      if (!Number.isNaN(v) && v > 0) criteria.maxPrice = v;
    }
    if (maxAge.trim() !== '') {
      const v = parseInt(maxAge, 10);
      if (!Number.isNaN(v) && v > 0) criteria.maxAge = v;
    }
    return filterMarketPool(pool, criteria);
  }, [pool, position, maxPrice, maxAge]);

  const onTapPlayer = useCallback(
    async (player: MarketPlayer) => {
      const offer = await proposePurchase(player.id, player.value);
      if (offer) {
        router.push({
          pathname: '/simulador-carrera/mercado/detalle',
          params: { playerId: player.id, amount: String(player.value) },
        });
      }
    },
    [proposePurchase, router],
  );

  const onBack = useCallback(() => {
    router.replace('/simulador-carrera/dashboard');
  }, [router]);

  // Render — branches por estado.
  const hasBudget = clubPresupuesto > 0;
  const showEmpty = marketState?.status === 'open' && pool.length === 0;
  const showNoBudget = !hasBudget;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { gap: spacing[3], padding: spacing[4] },
        ]}
        testID="mercado-lista-screen"
      >
        {/* Header */}
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
            {t('mercado.eyebrow')}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
            }}
          >
            {t('mercado.title')}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
              {t('mercado.budgetLabel')}
            </Text>
            <Text
              style={{
                color: hasBudget ? colors.textStrong : colors.danger,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
              }}
              testID="mercado-presupuesto"
            >
              {eur(clubPresupuesto)}
            </Text>
          </View>
        </View>

        {/* Filtros */}
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
            {t('mercado.filters')}
          </Text>
          {/* Chips de posición */}
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}
          >
            <Chip
              label={t('mercado.all')}
              active={position === null}
              onPress={() => setPosition(null)}
            />
            {(['ST', 'CM', 'CB', 'GK'] as Position[]).map((p) => (
              <Chip
                key={p}
                label={POSITION_LABEL[p]}
                active={position === p}
                onPress={() => setPosition(p)}
              />
            ))}
          </View>
          {/* Precio / edad */}
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <View style={{ flex: 1, gap: spacing[1] }}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                {t('mercado.maxPrice')}
              </Text>
              <TextInput
                value={maxPrice}
                onChangeText={setMaxPrice}
                keyboardType="numeric"
                placeholder="€M"
                placeholderTextColor={colors.textMuted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radii.md,
                  padding: spacing[2],
                  color: colors.textStrong,
                  fontSize: fontSize.base,
                }}
              />
            </View>
            <View style={{ flex: 1, gap: spacing[1] }}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                {t('mercado.maxAge')}
              </Text>
              <TextInput
                value={maxAge}
                onChangeText={setMaxAge}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={colors.textMuted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radii.md,
                  padding: spacing[2],
                  color: colors.textStrong,
                  fontSize: fontSize.base,
                }}
              />
            </View>
          </View>
        </View>

        {/* Lista / estados */}
        {showNoBudget ? (
          <EmptyState
            kind="no_budget"
            title={t('mercado.noBudgetTitle')}
            body={t('mercado.noBudgetBody')}
          />
        ) : showEmpty ? (
          <EmptyState
            kind="empty"
            title={t('mercado.emptyTitle')}
            body={t('mercado.emptyBody')}
          />
        ) : (
          <View
            style={{ gap: spacing[3] }}
            testID="mercado-lista-pool"
            accessibilityLabel={`${filtered.length} jugadores`}
          >
            {filtered.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                onPress={() => onTapPlayer(player)}
                disabled={!hasBudget}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View
        style={{
          padding: spacing[4],
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        }}
      >
        <Button
          label={t('mercado.back')}
          onPress={onBack}
          variant="secondary"
          fullWidth
          testID="mercado-back"
        />
      </View>
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        borderRadius: radii.pill,
        backgroundColor: active ? colors.primary : colors.surface2,
      }}
    >
      <Text
        style={{
          color: active ? colors.textOnPrimary : colors.textStrong,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.bold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PlayerRow({
  player,
  onPress,
  disabled,
}: {
  player: MarketPlayer;
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const club = ACADEMY_CLUBS.find((c) => c.id === player.fromClub.id);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing[4],
        gap: spacing[2],
        opacity: disabled ? 0.5 : 1,
      }}
      testID={`mercado-card-${player.id}`}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}
      >
        {club ? (
          <ClubCrest club={club} size={40} />
        ) : (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#1F2937',
            }}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
            }}
          >
            {player.name}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {POSITION_LABEL[player.position]} · {player.age}a · OVR {player.ovr}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
            }}
          >
            {eur(player.value)}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {player.fromClub.name}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState({
  kind,
  title,
  body,
}: {
  kind: 'empty' | 'no_budget';
  title: string;
  body: string;
}) {
  const { colors, radii, spacing, fontSize } = useTheme();
  return (
    <View
      style={{
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: kind === 'no_budget' ? colors.danger : colors.border,
        backgroundColor: colors.surface,
        padding: spacing[6],
        alignItems: 'center',
        gap: spacing[2],
      }}
      testID={`mercado-empty-${kind}`}
    >
      <Text
        style={{
          color: colors.textStrong,
          fontSize: fontSize.md,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.base,
          textAlign: 'center',
        }}
      >
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
});