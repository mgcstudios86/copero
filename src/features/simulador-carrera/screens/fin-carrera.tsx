import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useCareerStore } from '@/shared/store/careerStore';
import { cardToEntries } from '@/features/career/legends';
import { buildLegado, buildRetirementSummary } from '@/features/career/retirement';
import { RETIREMENT_AGE } from '@/features/career/season';
import { useLocale } from '@/i18n/locale-context';
import { trackGameEvent } from '@/lib/analytics';

/**
 * MGC-209 [6/6] + MGC-1736 (WF6) — FIN DE CARRERA.
 *
 * Replica `copero-web/web/src/screens/FinCarrera.tsx`: resumen con
 * edad de retiro, OVR final, partidos, goles+asist, atributos al
 * retiro, vitrina de títulos y legado. Datos derivados del motor
 * (`engine.ts#runCareerToRetirement` → log + profile final).
 *
 * Cleanup post-retiro (MGC-1736 AC de no-mutación):
 *  - `onRestart` es `async`: AWAITA `resetAll()` (drena flush + reset
 *    memoria + await clearCareerSave) ANTES de navegar a `/identity`,
 *    para que el usuario vea la pantalla de alta con AsyncStorage vacío
 *    y un store sin datos de la carrera anterior.
 *  - Guard de doble tap: el borrado no es idempotente-libre; si el
 *    usuario toca "Nueva carrera" dos veces, la segunda noop-ea.
 *  - Cleanup de unmount: si el usuario hace Back físico mientras el
 *    await de resetAll está corriendo, no seteamos estado ni navegamos.
 *  - Mientras corre el reset, el CTA muestra estado "loading" para
 *    bloquear interacción accidental.
 *  - Botón "Nueva carrera" es destructivo → lo declara con
 *    `accessibilityHint` i18n.
 */
export default function FinCarreraScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const { t } = useLocale();

  const profile = useCareerStore((s) => s.profile);
  const card = useCareerStore((s) => s.card);
  const log = useCareerStore((s) => s.log);
  const resetAll = useCareerStore((s) => s.resetAll);
  const resumeFromRetirement = useCareerStore((s) => s.resumeFromRetirement);

  // MGC-1802 P0-5 — handler del CTA 'Volver a la temporada'. Cambia el
  // stage de 'retirement' → 'season' ANTES de navegar, porque la pantalla
  // /temporada tiene un useEffect que redirige a /fin-carrera si el stage
  // sigue siendo 'retirement' (loop infinito de redirects). Sin este
  // cambio el botón 'Volver' no transiciona (QA MGC-1739).
  const onBackToSeason = useCallback(async () => {
    await resumeFromRetirement();
    router.replace('/simulador-carrera/temporada');
  }, [resumeFromRetirement, router]);

  // MGC-1736 — el borrado es async; si la pantalla se desmonta antes
  // de que resuelva (back físico), no navegamos ni seteamos estado.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // MGC-1736 — guard de doble tap + estado "loading" durante el await.
  const [restarting, setRestarting] = useState(false);

  // MGC-215 — modal de confirmación destructiva. El CTA "Nueva partida"
  // abre un modal nativo que pide confirmación antes de invocar
  // `resetAll` (que limpia TODAS las keys de AsyncStorage vía
  // `wipeAllCoperoKeys` — game stats + quiz + carrera). Sin este paso,
  // un tap accidental perdería el save legacy y el high score del juego
  // de palabras. El modal es accesible (role="alert", hint i18n) y se
  // descarta con tap fuera / botón "Cancelar".
  //
  // MGC-481 — el flow restart-limpio (PR #655 spec) requiere 3 pasos
  // visuales: (1) confirm con Cancelar/Accept, (2) pantalla de progreso
  // con spinner "Reiniciando…" durante el await de `resetAll`, (3)
  // cierre + navegación a /identity. Antes el paso (2) era invisible:
  // `restarting=true` sólo deshabilitaba los botones sin feedback
  // visual, dejando al usuario mirando un modal congelado mientras
  // `wipeAllCoperoKeys` corría. Ahora distinguimos dos sub-estados:
  // `confirmingRestart` (paso 1) y `restarting` (paso 2, modal muta
  // al spinner overlay).
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const openConfirm = useCallback(() => {
    if (restarting) return;
    setConfirmingRestart(true);
  }, [restarting]);
  const cancelConfirm = useCallback(() => {
    if (restarting) return;
    setConfirmingRestart(false);
  }, [restarting]);

  const summary = useMemo(() => {
    if (!log) return null;
    return buildRetirementSummary(profile, log);
  }, [profile, log]);

  const legado = useMemo(() => {
    if (!log) return '';
    return buildLegado(profile, log);
  }, [profile, log]);

  if (!summary || !card) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
        <View style={[styles.container, { padding: spacing[5] }]}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
            {t('retire.notFinished')}
          </Text>
          <View style={{ marginTop: spacing[4] }}>
            <Button
              label={t('retire.backSeason')}
              onPress={onBackToSeason}
              variant="primary"
              fullWidth
              hitSlop={44}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const entries = cardToEntries(card);
  const totalGA = summary.totalGoals + summary.totalAssists;
  const initialOvr = card.ovrInicial;
  const finalOvr = Math.max(40, summary.finalOvr);

  const onRestart = async () => {
    // MGC-1736 AC no-mutación — guard doble tap: si ya está corriendo
    // un reset, descartamos la segunda pulsación para no encolar dos
    // clearCareerSave() consecutivos.
    if (restarting) return;
    setRestarting(true);
    // MGC-481 — ya NO cerramos el modal acá: el spec de PR #655 step
    // 2 pide que el modal quede visible mostrando el spinner
    // "Reiniciando…" durante el await de `resetAll`. Antes
    // `setConfirmingRestart(false)` dejaba al usuario con pantalla
    // negra durante cientos de ms sin señal de progreso. Ahora el
    // modal cambia su contenido (cancel/accept → spinner + texto)
    // gracias a la rama condicional del render.
    //
    // MGC-481 — telemetría `career_restarted` (PR #655 post-condición):
    // emitimos el evento con `{ previousSeason, hadTrophies }` ANTES
    // del wipe para capturar el estado de la carrera que se va a
    // borrar. Si falla el reset (catch en resetAll no aplica — es
    // best-effort) el evento igual refleja la intención del usuario.
    // El evento está en `GameAnalyticsEvent` pero `fin-carrera.tsx`
    // (mobile) no lo emitía — sólo `App.tsx` (web sim) lo hacía en
    // un contexto distinto (replay del summary phase).
    trackGameEvent('career_restarted', {
      previousSeason: profile.season ?? 0,
      hadTrophies: (summary?.vitrina?.length ?? 0) > 0 ? 1 : 0,
    });
    await resetAll();
    // Si la pantalla se desmontó durante el await (back físico),
    // no navegamos ni reseteamos estado: el store ya quedó limpio
    // porque resetAll() corrió hasta el final.
    if (!mounted.current) return;
    setConfirmingRestart(false);
    router.replace('/simulador-carrera/identity');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[5], padding: spacing[4] }]}
        testID="fin-carrera-screen"
      >
        {/* Header */}
        <View style={{ gap: spacing[2], alignItems: 'center' }}>
          <View
            style={{
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[2],
              borderRadius: radii.pill,
              backgroundColor: '#FBBF24',
            }}
          >
            <Text style={{ color: '#0A120E', fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 2 }}>
              {t('retire.eyebrow')}
            </Text>
          </View>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['3xl'],
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
            accessibilityRole="header"
          >
            {t('retire.title')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center' }}>
            {t('retire.subtitle')}
          </Text>
        </View>

        {/* Stats grid */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[4],
          }}
        >
          <View style={{ flexDirection: 'row', gap: spacing[3], flexWrap: 'wrap' }}>
            <Stat label={t('retire.statRetirementAge')} value={`${summary.retirementAge}`} />
            <Stat label={t('retire.statFinalOvr')} value={`${finalOvr}`} valueColor={colors.primary} />
            <Stat label={t('retire.statApps')} value={`${summary.totalApps}`} />
            <Stat label={t('retire.statGoalsAssists')} value={`${totalGA}`} />
          </View>
        </View>

        {/* Attributes at retirement */}
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
              color: colors.textMuted,
              fontSize: 12,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            {t('retire.attributesTitle')}
          </Text>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}
            accessibilityLabel={t('retire.attributesA11y')}
          >
            {entries.map((e) => (
              <View
                key={`retire-${e.key}`}
                style={{
                  flexBasis: '23%',
                  flexGrow: 1,
                  paddingVertical: spacing[3],
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface2,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    fontWeight: fontWeight.bold,
                    letterSpacing: 1,
                  }}
                >
                  {e.key}
                </Text>
                <Text
                  style={{
                    color: colors.textStrong,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {e.value}
                  {(e.key === 'SKL' || e.key === 'WF') ? '★' : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Vitrina */}
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
              color: colors.textMuted,
              fontSize: 12,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            {t('retire.trophyTitle')}
          </Text>
          {summary.vitrina.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              {t('retire.trophyEmpty')}
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
              {summary.vitrina.map((t) => (
                <View
                  key={t}
                  style={{
                    flexBasis: '47%',
                    flexGrow: 1,
                    paddingVertical: spacing[4],
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface2,
                    alignItems: 'center',
                    gap: spacing[1],
                  }}
                >
                  <Text style={{ fontSize: 24 }}>🏆</Text>
                  <Text
                    style={{
                      color: colors.textStrong,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      textAlign: 'center',
                    }}
                  >
                    {t}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Legado */}
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
              fontSize: 12,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            {t('retire.legadoTitle')}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.xl,
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
            }}
          >
            {t('retire.ovrDelta', { initial: initialOvr, final: finalOvr })}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {t('retire.legadoLead')} {legado}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {t('retire.retiredAt', { age: RETIREMENT_AGE })}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] }}>
            <View style={{ flex: 1 }}>
              <Button
                label={t('retire.restart')}
                onPress={openConfirm}
                variant="primary"
                fullWidth
                accessibilityHint={t('retire.restartA11y')}
                testID="btn-fin-carrera-restart"
                hitSlop={44}
                disabled={restarting}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={t('retire.backSeason')}
                onPress={onBackToSeason}
                variant="secondary"
                fullWidth
                accessibilityHint={t('retire.backSeasonA11y')}
                testID="btn-fin-carrera-temporada"
                hitSlop={44}
              />
            </View>
          </View>
        </View>
      </ScrollView>
      {/* MGC-215 — modal nativo de confirmación destructiva para
          "Nueva partida". Tapar fuera / botón Cancelar cierran sin
          ejecutar el wipe. El confirm sí dispara `onRestart` que
          ahora NO cierra el modal — muta al paso 2 (spinner).
          MGC-481 — el contenido del modal se renderiza en dos ramas:
          (1) confirm con Cancelar/Accept cuando `resting===false`,
          (2) spinner + texto "Reiniciando…" cuando `resting===true`.
          El overlay oscuro + Pressable padre siguen activos en (2)
          pero el `onPress` interno se bloquea con el Pressable vacío
          y `cancelConfirm` queda protegido por el guard
          `if (restarting) return;` para que el usuario no pueda
          cancelar el wipe a mitad (sería el mismo force-stop edge
          case que documenta la spec §"Force-stop durante wipe"). */}
      <Modal
        visible={confirmingRestart}
        transparent
        animationType="fade"
        onRequestClose={cancelConfirm}
        testID="fin-carrera-confirm-modal"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('retire.confirmDismiss')}
          onPress={cancelConfirm}
          style={{
            flex: 1,
            backgroundColor: 'rgba(8, 12, 20, 0.65)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing[5],
          }}
        >
          <Pressable
            // Bloqueamos la propagación al overlay para que tap dentro
            // del card no cierre el modal.
            onPress={() => {}}
            style={{
              width: '100%',
              maxWidth: 420,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing[5],
              gap: spacing[4],
            }}
          >
            {restarting ? (
              // MGC-481 — paso 2 del flow restart-limpio. Spinner +
              // texto i18n. Sin botones: el wipe es awaitable y el
              // modal se cierra solo cuando resetAll resuelve y
              // `onRestart` setea `confirmingRestart=false`. Si el
              // usuario intenta tap fuera, `cancelConfirm` noop-ea
              // por el guard `if (restarting) return;`.
              <View
                testID="fin-carrera-wiping-overlay"
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${t('retire.wipingTitle')}. ${t('retire.wipingBody')}`}
                style={{
                  alignItems: 'center',
                  gap: spacing[3],
                  paddingVertical: spacing[3],
                }}
              >
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                  testID="fin-carrera-wiping-spinner"
                />
                <Text
                  accessibilityRole="header"
                  style={{
                    color: colors.textStrong,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                    textAlign: 'center',
                  }}
                >
                  {t('retire.wipingTitle')}
                </Text>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: fontSize.base,
                    lineHeight: fontSize.base * 1.4,
                    textAlign: 'center',
                  }}
                >
                  {t('retire.wipingBody')}
                </Text>
              </View>
            ) : (
              // Paso 1 — confirm con Cancelar/Accept.
              <>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: colors.textStrong,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {t('retire.confirmTitle')}
                </Text>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: fontSize.base,
                    lineHeight: fontSize.base * 1.4,
                  }}
                >
                  {t('retire.confirmBody')}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t('retire.confirmCancel')}
                      onPress={cancelConfirm}
                      variant="secondary"
                      fullWidth
                      hitSlop={44}
                      testID="btn-fin-carrera-confirm-cancel"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t('retire.confirmAccept')}
                      onPress={onRestart}
                      variant="primary"
                      fullWidth
                      hitSlop={44}
                      testID="btn-fin-carrera-confirm-accept"
                      accessibilityHint={t('retire.restartA11y')}
                    />
                  </View>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: '40%',
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface2,
        padding: spacing[4],
        gap: spacing[1],
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 12,
          fontWeight: fontWeight.bold,
          letterSpacing: 2,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: valueColor ?? colors.textStrong,
          fontSize: fontSize.xl,
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
