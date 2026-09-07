// src/features/simulador-carrera/screens/team-select.tsx — Copero
//
// MGC-1648 — WF2 selección de equipo obligatoria en el alta. Pantalla
// intermedia entre `/identity` (WF1) y `/season-hub` (WF3). El usuario
// llega con `profile.club === null` y debe elegir uno de los 5 clubes del
// top popularidad antes de arrancar la carrera.
//
// Patrón layout (MGC-1286 / MGC-1448): outer ScrollView flex:1 +
// sticky-footer absoluto bottom:0 height:240. Mismo split que identity.tsx
// — header + lista scrollable arriba, CTA primario fijo abajo. El footer
// permanece visible aunque se scrollee la lista, y el CTA queda siempre
// sobre el IME en Android vía translateY.
//
// Persistencia (MGC-1648): el tap en un club llama `selectInitialClub` que
// es async + await `flushPendingSave`. El CTA «Empezar carrera» AWAITA el
// mismo flush y sólo después navega al dashboard. Garantiza AC7 — un
// force-stop entre la selección y el push al hub no pierde el snapshot
// (el club ya está en AsyncStorage antes del `router.replace`).
//
// i18n (MGC-1648 + MGC-1570 patrón): las strings viven en
// `src/i18n/copy.ts` bajo `teamSelect.*` y se resuelven vía `useLocale`.
// Re-render al cambiar idioma — `useLocale` está suscrito (ver MGC-1534
// sobre identity.tsx para el rationale de la subscription). Los nombres
// de los clubes permanecen en español en los tres locales (dominio del
// juego: fútbol argentino; los nombres propios no se traducen).

import React, { useState, useCallback } from 'react';
import {
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button, ClubCrest } from '@/design/components';
import { useCareerStore } from '@/shared/store/careerStore';
import { useLocale } from '@/i18n/locale-context';
import { ACADEMY_CLUBS } from '@/features/career/clubs';
import type { Club } from '@/types/career';

// MGC-1652 — WCAG 2.5.5: hitSlop 44dp total por eje (PR-379 / MGC-1502).
const HIT_SLOP_44 = { top: 22, left: 22, right: 22, bottom: 22 } as const;

const MAX_REPUTATION = 5;

/**
 * MGC-1648 — reputación visual 1..MAX_REPUTATION como bullets filled /
 * empty. Evita depender de un asset SVG/PNG y mantiene el contraste AA
 * WCAG forzando colors.text vs colors.border. Misma cadencia visual que
 * el scoreboard de `src/features/ui/ScoreBadge.tsx`.
 */
function ReputationDots({
  value,
  filledColor,
  emptyColor,
}: {
  value: number;
  filledColor: string;
  emptyColor: string;
}) {
  const dots = [];
  for (let i = 1; i <= MAX_REPUTATION; i++) {
    dots.push(
      <View
        key={i}
        testID={`reputation-dot-${i <= value ? 'filled' : 'empty'}`}
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          marginRight: 4,
          backgroundColor: i <= value ? filledColor : emptyColor,
        }}
      />,
    );
  }
  return <View style={{ flexDirection: 'row', alignItems: 'center' }}>{dots}</View>;
}

export default function TeamSelectScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily, lineHeight } =
    useTheme();

  const { t } = useLocale();

  const profile = useCareerStore((s) => s.profile);
  const selectInitialClub = useCareerStore((s) => s.selectInitialClub);

  // MGC-1648 — estado local de selección. El snapshot persistido en
  // `profile.club` se mantiene autoritativo pero la UI también trackea la
  // selección del usuario antes de confirmar con «Empezar carrera» para
  // que el feedback visual (border + accessibilityState.selected) aparezca
  // instantáneo en el tap. Sin esto el re-render depende del flush de
  // AsyncStorage y el highlight llega tarde.
  const [selectedId, setSelectedId] = useState<string | null>(profile.club?.id ?? null);
  const [submitting, setSubmitting] = useState(false);

  const onPick = useCallback(
    (club: Club) => {
      setSelectedId(club.id);
    },
    [],
  );

  const canContinue = selectedId !== null && !submitting;

  const onContinue = useCallback(async () => {
    if (!canContinue) return;
    const club = ACADEMY_CLUBS.find((c) => c.id === selectedId);
    if (!club) return;
    setSubmitting(true);
    try {
      // MGC-1648 — `selectInitialClub` setea `profile.club` + `clubPresupuesto`
      // + `clubInteres` y AWAITA el flush de AsyncStorage. El `await` acá
      // bloquea hasta que `setItem` resuelva; el `router.replace` posterior
      // ocurre sólo con el snapshot ya en disco (AC7 — mismo patrón que
      // `commitIdentityAndStartDraft` de MGC-273).
      await selectInitialClub(club);
      // MGC-1737 (UX1) — post-identity ya NO escala por `/dashboard`.
      // El operador pidió quitar el dashboard como pantalla inicial post-
      // identity: después de elegir club llevamos al usuario directo al
      // hub de temporada (WF3 / MGC-1649), que ya concentra player card,
      // fatiga, stats y CTAs a timeline + decisión semanal. El dashboard
      // queda accesible sólo como ruta de resume (`resumeRouteForStage`)
      // para sesiones guardadas con `stage === 'dashboard' | 'academy' |
      // 'clubStart'` — los flujos nuevos no lo tocan.
      //
      // MGC-374 + MGC-532 + MGC-633 — diferir la navegación a través de
      // InteractionManager + rAF + setTimeout 250ms para que RN termine de
      // procesar el settle del tap + el lazy chunk del hub antes del
      // push. Sin el defer el hub rebotaba al launcher en ZY22G728HN
      // (race entre reanimated IME dismiss y Stack animation).
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            router.replace('/simulador-carrera/season-hub');
          }, 250);
        });
      });
    } catch {
      // Si AsyncStorage explota (quota / red) el caller puede reintentar
      // con el mismo CTA. No navegamos para no perder la selección.
      setSubmitting(false);
    }
  }, [canContinue, selectedId, selectInitialClub, router]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.kavContent}>
          {/* MGC-1286 / MGC-1448 — outer ScrollView flex:1 con scrollContent
              paddingBottom:240 para despejar el sticky-footer. Sin esto el
              último club (River) cae bajo el footer top y=1530 y sus bounds
              quedan invertidos en el hierarchy dump fresh-mount (patrón
              canónico MGC-1411 opción B). removeClippedSubviews=false +
              collapsable=false mantienen el resource-id estable en
              uiautomator. */}
          <ScrollView
            testID="team-select-scroll"
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { padding: spacing[4], gap: spacing[4] },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            collapsable={false}
            removeClippedSubviews={false}
          >
            <View testID="team-select-header" style={{ gap: spacing[2], flexShrink: 0 }}>
              <Text
                style={{
                  color: colors.primary,
                  letterSpacing: 4,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.bold,
                }}
                accessibilityRole="header"
              >
                {t('teamSelect.eyebrow')}
              </Text>
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize['2xl'],
                  fontFamily: fontFamily.display,
                  fontWeight: fontWeight.bold,
                  lineHeight: fontSize['2xl'] * lineHeight.tight,
                }}
                accessibilityRole="header"
              >
                {t('teamSelect.title')}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
                {t('teamSelect.subtitle')}
              </Text>
            </View>

            <View testID="team-select-list" style={{ gap: spacing[3] }}>
              {ACADEMY_CLUBS.map((club) => {
                const active = selectedId === club.id;
                const reputation = club.reputation ?? 3;
                return (
                  <Pressable
                    key={club.id}
                    onPress={() => onPick(club)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t('teamSelect.cardA11y', {
                      name: club.name,
                      league: club.league,
                      reputation,
                      maxReputation: MAX_REPUTATION,
                    })}
                    // MGC-1652 — WCAG 2.5.5: hitSlop 44dp total por eje
                    // (PR-379 / MGC-1502). Card 88dp + HIT_SLOP_44 → 176dp hitbox.
                    hitSlop={HIT_SLOP_44}
                    collapsable={false}
                    testID={`team-select-card-${club.id}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[3],
                      padding: spacing[3],
                      borderRadius: radii.lg,
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primarySoft : colors.surface,
                      minHeight: 88,
                    }}
                  >
                    <ClubCrest club={club} size={64} />
                    <View style={{ flex: 1, gap: spacing[1] }}>
                      <Text
                        style={{
                          color: active ? colors.primary : colors.textStrong,
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.bold,
                        }}
                        numberOfLines={1}
                      >
                        {club.name}
                      </Text>
                      <Text
                        style={{
                          color: colors.textMuted,
                          fontSize: fontSize.sm,
                        }}
                        numberOfLines={1}
                      >
                        {club.league}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                        <Text
                          style={{
                            color: colors.textMuted,
                            fontSize: fontSize.xs,
                            letterSpacing: 1,
                            fontWeight: fontWeight.semibold,
                          }}
                        >
                          {t('teamSelect.reputationLabel')}
                        </Text>
                        <ReputationDots
                          value={reputation}
                          filledColor={active ? colors.primary : colors.text}
                          emptyColor={colors.border}
                        />
                        <Text
                          style={{
                            color: colors.textMuted,
                            fontSize: fontSize.xs,
                          }}
                        >
                          {t('teamSelect.reputationValue', { n: reputation })}
                        </Text>
                      </View>
                    </View>
                    {active ? (
                      <View
                        testID={`team-select-badge-${club.id}`}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        style={{
                          paddingHorizontal: spacing[2],
                          paddingVertical: spacing[1],
                          borderRadius: radii.md,
                          backgroundColor: colors.primary,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.textOnPrimary,
                            fontSize: fontSize.xs,
                            fontWeight: fontWeight.bold,
                            letterSpacing: 1,
                          }}
                        >
                          {t('teamSelect.selectedBadge')}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          {/* MGC-1448 — sticky-footer absoluto bottom:0 height:240 opaco.
              Mismo patrón que identity.tsx: el bg ocupa exactamente el area
              del overlap; el Pressable del CTA (hijo) captura su propio tap
              (default `auto`). pointerEvents="box-none" en el wrapper
              contenedor (MGC-1578 PR-394) garantiza que un swipe sobre el
              bg vacío del footer atraviese al ScrollView, evitando consumir
              scrolls del usuario. */}
          <View
            testID="team-select-sticky-footer"
            collapsable={false}
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 240,
              justifyContent: 'flex-end',
              backgroundColor: colors.bg,
            }}
          >
            <View
              pointerEvents="box-none"
              style={{
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
                backgroundColor: colors.bg,
                padding: spacing[4],
              }}
            >
              {!canContinue ? (
                <Text
                  testID="team-select-continue-hint"
                  style={{
                    color: colors.textMuted,
                    fontSize: fontSize.xs,
                    lineHeight: 14,
                    includeFontPadding: false,
                    marginBottom: spacing[1],
                    textAlign: 'center',
                  }}
                >
                  {t('teamSelect.continueHint')}
                </Text>
              ) : null}
              <Button
                label={t('teamSelect.continue')}
                onPress={onContinue}
                variant="primary"
                size="lg"
                fullWidth
                disabled={!canContinue}
                testID="btn-team-select-continue"
                accessibilityHint={t('teamSelect.continueA11yHint')}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  kav: { flex: 1 },
  kavContent: { flex: 1, flexDirection: 'column', position: 'relative' },
  // MGC-1286 / MGC-1448 — ScrollView absolute full-bounds garantiza que
  // el wrapper ocupe exactamente el alto del kavContent y que el measure
  // pass de RN-Android no colapse sus bounds al viewport visible (mismo
  // patrón canónico que identity.tsx tras MGC-1452 rootcause fix).
  scroll: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // MGC-1286 — paddingBottom:240 reserva el area del overlap del sticky-
  // footer para que el último club (River) sea accesible tras scroll
  // completo sin invertir bounds contra el footer top.
  scrollContent: { flexGrow: 1, paddingBottom: 240 },
});
