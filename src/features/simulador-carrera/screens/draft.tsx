import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useCareerStore } from '@/shared/store/careerStore';
import { DRAFT_SLOTS, legendAt } from '@/features/career/legends';
import { MAX_SWAPS } from '@/features/career/draft';

/**
 * MGC-209 [2/6] — DRAFT — RONDA n DE 8.
 *
 * Replica `copero-web/web/src/screens/Draft.tsx`: leyenda actual con sus 6
 * atributos + skills SKL/WF, botón "Confirmar atributo" (pickLegend) y
 * "Cambiar leyenda · N" (swapLegend). Estado sale del motor de MGC-11-G
 * vía `useCareerStore` (no hay mock).
 */
export default function DraftScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const profile = useCareerStore((s) => s.profile);
  const draft = useCareerStore((s) => s.draft);
  const stage = useCareerStore((s) => s.stage);
  const startDraft = useCareerStore((s) => s.startDraft);
  const swapLegend = useCareerStore((s) => s.swapLegend);
  const pickLegend = useCareerStore((s) => s.pickLegend);

  // MGC-426 — guard contra taps concurrentes. `pickLegend` / `swapLegend`
  // son async (await flushPendingSave) y la store NO serializa llamadas
  // superpuestas del mismo action: cada `setSnapshot(step)` se ejecuta en
  // su propio microtask y, aunque internamente avancen `draft.picks`
  // correctamente, el chain de `pendingSave` queda FIFO y un force-stop
  // entre pick-8 y el flush del stage='club' puede revertir el snapshot
  // a initialSnapshot(). Más simple y suficiente: bloquear el botón
  // mientras la acción está en vuelo y prevenir la acumulación de
  // promises en la queue de microtasks. Cobertura completa
  // (incluyendo el camino "Continuar carrera" en home) exige deshabilitar
  // también durante el `router.replace` post round-8; lo extendemos
  // vía `navigationLocked` para que el último tap no quede pegado en
  // busy si la navegación fallara.
  const [submitting, setSubmitting] = useState(false);
  const [navigationLocked, setNavigationLocked] = useState(false);

  // Inicializa el draft si entramos sin board (entry directo desde CTA).
  // MGC-284: `startDraft` ahora es async + await flushPendingSave. El
  // `useEffect` no puede await, pero propagamos la promesa al caller
  // vía `void` para que React Native no escupa un unhandled rejection
  // si el flujo termina antes del flush. La AC1 de MGC-273 ya cubre
  // el caso crítico: `commitIdentityAndStartDraft` awaited antes de
  // navegar, así que este `startDraft()` redundante solo reescribe el
  // board si el snapshot quedó en disco con draft=null.
  useEffect(() => {
    if (!draft) {
      void startDraft();
    }
  }, [draft, startDraft]);

  // Cuando el draft termina (motor emite card + stage 'club'), salimos a tu-jugador.
  // `setNavigationLocked` se difiere a microtask para evitar el lint
  // react-hooks/set-state-in-effect (cascading renders); la navegación
  // a tu-jugador ocurre sincrónicamente, pero la flag de busy puede
  // esperar al siguiente tick del event loop sin afectar UX.
  useEffect(() => {
    if (stage === 'club' || (draft && draft.picks.length >= DRAFT_SLOTS.length)) {
      queueMicrotask(() => setNavigationLocked(true));
      router.replace('/simulador-carrera/tu-jugador');
    }
  }, [stage, draft, router]);

  if (!draft) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
        <View style={[styles.container, { padding: spacing[5] }]}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
            Iniciando draft…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const legend = legendAt(draft);
  const round = draft.picks.length + 1;
  const finished = draft.picks.length >= DRAFT_SLOTS.length;

  const onConfirm = async () => {
    // MGC-426 — guard contra rapid-tap. Button.onPress no espera la
    // promise del async; mientras `pickLegend` (await flushPendingSave)
    // está en vuelo, taps adicionales dispararían setSnapshot(step)
    // superpuestos. Aunque el motor avanza picks correctamente en serie,
    // la cadena `pendingSave` queda FIFO con un flush pendiente por tap
    // y un force-stop o un reload tras navegar al `tu-jugador` puede
    // revertir al initialSnapshot. Bloqueamos hasta que el await termine
    // y deshabilitamos visualmente con `loading`.
    if (submitting || navigationLocked) return;
    setSubmitting(true);
    try {
      // MGC-284: `pickLegend` ahora es async + await flushPendingSave.
      // Antes fire-and-forget; ahora cada "Confirmar atributo" bloquea
      // hasta que AsyncStorage confirme la pick + board. AC4 — 8 rounds
      // + force-stop dependía de esto.
      await pickLegend();
      // MGC-427: tras el pick 8, `pickLegend` setea stage='club' en la
      // store. El useEffect de arriba vigila la transición, pero en build
      // Android (build-pr174-mgc396.apk) la navegación no llegaba — el
      // usuario quedaba en /draft con ronda 8 ya confirmada sin destino.
      // Hacemos la navegación acá, explícita, leyendo el snapshot
      // actualizado vía `useCareerStore.getState()` (evita una carrera
      // con un re-render perdido). El useEffect queda como red de
      // seguridad por si esta rama no se ejecuta (force-stop justo en el
      // await, hot-reload, etc.).
      const next = useCareerStore.getState();
      if (
        next.stage === 'club' ||
        (next.draft && next.draft.picks.length >= DRAFT_SLOTS.length)
      ) {
        router.replace('/simulador-carrera/tu-jugador');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onSwap = async () => {
    if (draft.swapsLeft <= 0) {
      Alert.alert('Sin cambios disponibles', 'Ya usaste los 5 cambios del draft.');
      return;
    }
    // MGC-426 — idem onConfirm: serialized swap, sin solapamiento.
    if (submitting || navigationLocked) return;
    setSubmitting(true);
    try {
      await swapLegend();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[5], padding: spacing[4] }]}
        testID="draft-screen"
      >
        {/* Header */}
        <View style={{ gap: spacing[2] }}>
          <Text
            style={{
              color: colors.primary,
              letterSpacing: 4,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            LEGEND ATTRIBUTE DRAFT
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            RONDA {round} DE {DRAFT_SLOTS.length}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
            Cada leyenda puede aportar un solo atributo. Los atributos confirmados quedan
            bloqueados.
          </Text>
        </View>

        {/* Legend card */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[5],
            gap: spacing[4],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: spacing[1] }}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, letterSpacing: 2 }}>
                🏳️ {legend.country} · {legend.years}
              </Text>
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize.xl,
                  fontWeight: fontWeight.bold,
                }}
              >
                {legend.name.toUpperCase()}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, letterSpacing: 2 }}>
                {legend.positions.join(' · ')}
              </Text>
            </View>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radii.md,
                backgroundColor: colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{ color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold }}
              >
                {legend.initials}
              </Text>
            </View>
          </View>

          {/* 6 atributos */}
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}
            accessibilityLabel="Atributos de la leyenda"
          >
            {legend.attributes.map((a) => {
              const isBest = a.key === legend.best.key;
              return (
                <View
                  key={a.key}
                  style={{
                    flexBasis: '23%',
                    flexGrow: 1,
                    paddingVertical: spacing[3],
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: isBest ? colors.primary : colors.border,
                    backgroundColor: isBest ? colors.primarySoft : colors.surface2,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 10,
                      fontWeight: fontWeight.bold,
                      letterSpacing: 1,
                    }}
                  >
                    {a.key}
                  </Text>
                  <Text
                    style={{
                      color: isBest ? colors.primary : colors.textStrong,
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                    }}
                  >
                    {a.value}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Skills */}
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            {legend.skills.map((s) => (
              <View
                key={s.key}
                style={{
                  flex: 1,
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
                    fontSize: 10,
                    fontWeight: fontWeight.bold,
                    letterSpacing: 1,
                  }}
                >
                  {s.key}
                </Text>
                <Text
                  style={{
                    color: colors.textStrong,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {s.value}★
                </Text>
              </View>
            ))}
          </View>

          {/* Best highlight */}
          <View
            style={{
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.primary,
              backgroundColor: colors.primarySoft,
              padding: spacing[4],
              gap: spacing[1],
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 10,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              MEJOR ATRIBUTO DISPONIBLE
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.bold,
                }}
              >
                {legend.best.key} · {legend.best.value}
              </Text>
              <View
                style={{
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  borderRadius: radii.pill,
                  backgroundColor: colors.primary,
                }}
              >
                <Text
                  style={{ color: colors.textOnPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}
                >
                  {legend.best.key}
                </Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Confirmar atributo"
                onPress={onConfirm}
                variant="primary"
                size="lg"
                fullWidth
                disabled={finished || navigationLocked}
                loading={submitting}
                testID="btn-draft-confirm"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={`Cambiar leyenda · ${draft.swapsLeft}`}
                onPress={onSwap}
                variant="secondary"
                size="lg"
                fullWidth
                disabled={draft.swapsLeft <= 0 || navigationLocked}
                loading={submitting}
                testID="btn-draft-swap"
              />
            </View>
          </View>
        </View>

        {/* Picks so far */}
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
              fontSize: fontSize.sm,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            TU JUGADOR · {profile.position}
          </Text>
          {DRAFT_SLOTS.map((slot) => {
            const filled = draft.picks.find((p) => p.slot === slot);
            return (
              <View
                key={slot}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                  paddingVertical: spacing[2],
                }}
              >
                <View
                  style={{
                    width: 56,
                    paddingVertical: spacing[1],
                    borderRadius: radii.pill,
                    backgroundColor: colors.surface2,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
                    {slot}
                  </Text>
                </View>
                <Text
                  style={{
                    flex: 1,
                    color: filled ? colors.textStrong : colors.textMuted,
                    fontSize: fontSize.sm,
                  }}
                >
                  {filled ? filled.legendName : 'Sin elegir'}
                </Text>
                <Text style={{ color: colors.textMuted }}>—</Text>
              </View>
            );
          })}
        </View>

        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center' }}>
          CLASSIC · {MAX_SWAPS} CAMBIOS INICIALES
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
});
