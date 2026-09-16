/**
 * MGC-245 — pantalla `/alineacion`.
 *
 * Punto de entrada a WF4 partido + WF5 post-partido. Antes (MGC-1650) el
 * CTA "Jugar la próxima fecha" del dashboard llamaba `startMatch()` y
 * navegaba directo a `/match` → el resultado del partido se resolvía sin
 * intervención del usuario (auto-play). QA MGC-240 §AC3 reportó que eso
 * violaba la spec original MGC-213 ("alineación si no estaba ya").
 *
 * Esta pantalla media entre dashboard y `/match`:
 *   1. Muestra las 3 opciones tácticas M1 (`conservadora`, `todo`,
 *      `lider`) con un delta visible (texto, no número — el motor sigue
 *      determinista por ahora).
 *   2. CTA "Confirmar" deshabilitado hasta que el usuario elija una
 *      opción (state `matchStore.alignment !== null`).
 *   3. On confirm: `setAlignment()` → `startMatch()` (depósito del
 *      outcome en matchStore) → `router.push('/simulador-carrera/match')`.
 *
 * Carga lazy desde el file-based wrapper `app/simulador-carrera/alineacion.tsx`
 * para preservar el code-split existente (MGC-771).
 */
import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design';
import { Button } from '@/design/components/Button';
import { useMatchStore, type Alignment } from '@/shared/store/matchStore';
import { useCareerStore } from '@/shared/store/careerStore';
import { copy as esArCopy } from '@/design/copy/es-AR/simulador-carrera';

/** MGC-1729 (HIGH-2) — 44dp de área tocable en los CTA críticos. */
const HIT_SLOP_44 = { top: 22, left: 22, right: 22, bottom: 22 } as const;

type AlignmentOption = {
  id: Alignment;
  titleKey: 'match_m1_conservadora' | 'match_m1_todo' | 'match_m1_lider';
  deltaKey: 'alineacion_delta_conservadora' | 'alineacion_delta_todo' | 'alineacion_delta_lider';
  accent: 'safe' | 'aggressive' | 'leader';
};

const OPTIONS: AlignmentOption[] = [
  {
    id: 'conservadora',
    titleKey: 'match_m1_conservadora',
    deltaKey: 'alineacion_delta_conservadora',
    accent: 'safe',
  },
  {
    id: 'todo',
    titleKey: 'match_m1_todo',
    deltaKey: 'alineacion_delta_todo',
    accent: 'aggressive',
  },
  {
    id: 'lider',
    titleKey: 'match_m1_lider',
    deltaKey: 'alineacion_delta_lider',
    accent: 'leader',
  },
];

export default function AlineacionScreen() {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const router = useRouter();
  const copy = useDesignCopy();
  const alignment = useMatchStore((s) => s.alignment);
  const setAlignment = useMatchStore((s) => s.setAlignment);
  const startMatch = useCareerStore((s) => s.startMatch);

  // Limpia la alineación al entrar (idempotente). Si el usuario ya venía
  // con una selección previa (re-entry desde /match con back), la
  // pisa — el flow asume que `/alineacion` es un paso obligatorio
  // antes de cada partido. Esto evita el bug "elegí conservadora hace
  // 3 partidos, sigo eligiendo lo mismo sin querer".
  useEffect(() => {
    setAlignment(null);
    // Solo en mount; el setter es estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onConfirm = async () => {
    if (!alignment) return;
    try {
      await startMatch();
    } catch {
      // best-effort: si startMatch falla (imports dinámicos rotos),
      // el match screen muestra su propio error y deja volver.
    }
    router.push('/simulador-carrera/match');
  };

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
        testID="alineacion-screen"
      >
        <View style={{ gap: spacing[2] }}>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 12,
              letterSpacing: 2,
              fontWeight: fontWeight.bold,
            }}
          >
            {copy('alineacion_step')}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            {copy('alineacion_title')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {copy('alineacion_subtitle')}
          </Text>
        </View>

        <View style={{ gap: spacing[3] }}>
          {OPTIONS.map((opt) => {
            const selected = alignment === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setAlignment(opt.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={copy(opt.titleKey)}
                accessibilityHint={copy(opt.deltaKey)}
                testID={`alignment-option-${opt.id}`}
                hitSlop={HIT_SLOP_44}
                style={({ pressed }) => [
                  {
                    borderRadius: radii.lg,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: pressed ? colors.surface2 : colors.surface,
                    padding: spacing[4],
                    gap: spacing[2],
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    style={{
                      color: colors.textStrong,
                      fontSize: fontSize.md,
                      fontWeight: fontWeight.bold,
                      flex: 1,
                    }}
                  >
                    {copy(opt.titleKey)}
                  </Text>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : 'transparent',
                    }}
                  />
                </View>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                  {copy(opt.deltaKey)}
                </Text>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 11,
                    letterSpacing: 1,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {copy(`alineacion_tag_${opt.accent}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button
          label={copy('alineacion_cta_confirm')}
          onPress={onConfirm}
          variant="primary"
          size="lg"
          fullWidth
          disabled={!alignment}
          testID="btn-alineacion-confirm"
          accessibilityLabel={copy('alineacion_cta_confirm')}
          accessibilityHint={copy('alineacion_cta_hint')}
          hitSlop={HIT_SLOP_44}
        />

        <Button
          label={copy('alineacion_cta_back')}
          onPress={() => router.replace('/simulador-carrera/dashboard')}
          variant="ghost"
          size="md"
          fullWidth
          testID="btn-alineacion-back"
          accessibilityLabel={copy('alineacion_cta_back')}
          hitSlop={HIT_SLOP_44}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Resolvedor de copy local. La pantalla vive en
 * `src/features/simulador-carrera/screens/` y reusa el mismo patrón que
 * `dashboard.tsx` (MGC-771). Las claves `match_m1_*` ya existen en
 * `src/design/copy/{es-AR,en-US,zh-CN}/simulador-carrera.ts`; las
 * nuevas `alineacion_*` se agregan en es-AR y caen al fallback de
 * español si el locale activo no las override (en/zh heredan via
 * default-fallback en `design/copy/index.ts`).
 */
type CopyResolver = (key: string) => string;

function useDesignCopy(): CopyResolver {
  return useMemo<CopyResolver>(() => {
    return (key: string): string => {
      const entry = (esArCopy as unknown as Record<string, { raw: string }>)[key];
      if (!entry) return key;
      return entry.raw;
    };
  }, []);
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
});