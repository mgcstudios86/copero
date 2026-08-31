import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  InteractionManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { onKeyActivate } from '@/design/utils/keyboardActivation';
import { useCareerStore } from '@/shared/store/careerStore';
import { POSITIONS, GROUP_COLOR } from '@/features/career/positions';
import { NATIONALITIES } from '@/features/career/nationalities';
import { isIdentityComplete } from '@/features/career/identity-state';
import type { Foot } from '@/types/career';

// Lazy-load JerseyPreview (MGC-482): separa el SVG patterns (~10 KB)
// del chunk inicial de /identity. Mejora LCP sin cambiar UX
// (placeholder mientras carga).
const JerseyPreview = lazy(() =>
  import('@/design/components/JerseyPreview').then((m) => ({ default: m.JerseyPreview })),
);

export default function IdentityScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily, lineHeight } = useTheme();
  const insets = useSafeAreaInsets();

  // MGC-621: el footer fijo necesita elevarse con translateY negativo
  // cuando el IME está abierto para que Continue quede sobre el teclado
  // en ZY22G728HN (1080x2400). El KAV con behavior=height (PR-226) solo
  // reduce ~152 px del ancestor flex en RN-Android con adjustResize.
  // El approach: Keyboard.addListener('keyboardDidShow'/'keyboardDidHide')
  // + translateY=-keyboardHeight en el footer. Restamos insets.bottom
  // porque SafeAreaView edges=['bottom'] ya dejó ese espacio reservado.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(Math.max(0, e.endCoordinates.height - insets.bottom));
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  const profile = useCareerStore((s) => s.profile);
  const setName = useCareerStore((s) => s.setName);
  const setNumber = useCareerStore((s) => s.setNumber);
  const setPosition = useCareerStore((s) => s.setPosition);
  const setNationality = useCareerStore((s) => s.setNationality);
  const setPreferredFoot = useCareerStore((s) => s.setPreferredFoot);
  // MGC-374: el contrato del flow E2E (PR #169, simulador-carrera.spec.ts:133,
  // a11y-keyboard.spec.ts:68) navega identity → /dashboard. El draft de 8 rondas
  // se sigue disparando desde el botón "Empezar draft de leyendas" del propio
  // dashboard (dashboard.tsx:352). Volvemos al patrón simple `commitIdentity +
  // router.push('/dashboard')` que existía antes de MGC-249/MGC-251.
  const commitIdentity = useCareerStore((s) => s.commitIdentity);

  const [nationalityQuery, setNationalityQuery] = useState('');
  const filteredNationalities = useMemo(() => {
    const q = nationalityQuery.trim().toLowerCase();
    if (!q) return NATIONALITIES;
    return NATIONALITIES.filter(
      (n) => n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q),
    );
  }, [nationalityQuery]);

  const canContinue = isIdentityComplete(profile);

  const onContinue = () => {
    if (!canContinue) return;
    // MGC-374: tras definir identidad, enrutamos al dashboard (no al draft).
    // El draft arranca desde el CTA del propio dashboard. Mantener el stage
    // sincronizado con la URL evita el "Unmatched Route" que QA reprodujo en
    // PR #169 (9/33 specs fallaban esperando `**/simulador-carrera/dashboard`).
    //
    // MGC-532 — el push al dashboard se difiere hasta que RN termine de
    // procesar las interacciones pendientes (`InteractionManager.runAfterInteractions`).
    // En ZY22G728HN + PR #197 (footer fijo), el push síncrono inmediato
    // competía con la animación de focus del EditText recién dismissed
    // y el chunk lazy del dashboard (~1 s de Metro). El resultado era
    // que la app montaba `dashboard-screen` 146 ms post-tap y luego
    // rebotaba al launcher 645 ms después — el OS mataba el proceso
    // porque la transición de Stack + lazy-load del chunk del dashboard
    // coincidía con el foco residual del teclado aún en reanimación
    // (QA MGC-531 sobre PR #202, step 12 de `draft-complete-club.yaml`
    // falla con `Element not found: btn-dashboard-draft`).
    //
    // Diferir a `runAfterInteractions` deja que RN complete la animación
    // de focus → blur del EditText + cualquier settle de layout antes
    // de disparar la navegación, eliminando el conflicto.
    //
    // Además usamos `router.replace` en vez de `push` para que identity
    // no quede en el back-stack post-commit (memory pressure + UX más
    // limpio: back desde dashboard va a home, no al form ya enviado).
    commitIdentity();
    InteractionManager.runAfterInteractions(() => {
      router.replace('/simulador-carrera/dashboard');
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      {/* MGC-429: el testID `identity-screen` vive en el wrapper
          (`app/simulador-carrera/identity.tsx`) que monta sincrónicamente
          antes de que el chunk lazy de este componente termine de cargar.
          Antes este `ScrollView` interno también llevaba el testID y
          rompía `getByTestId('identity-screen')` por strict-mode
          (resolvía a 2 elementos: el wrapper `View` y este `ScrollView`).
          Lo quitamos para preservar un único nodo testeable. */}
      {/* MGC-517: layout split — form scrollable arriba, footer fijo abajo.
          Patrón mobile-first: el CTA primario nunca queda atrapado debajo
          del soft keyboard. Antes el Continue estaba al final del ScrollView
          y con teclado abierto quedaba fuera del fold visible. */}
      <ScrollView
        testID="identity-scroll"
        contentContainerStyle={[styles.container, { gap: spacing[5], padding: spacing[4], paddingBottom: spacing[6] }]}
        keyboardShouldPersistTaps="handled"
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
            SIMULADOR DE CARRERA
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
            Define tu identidad
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
            Tu jugador empieza con 16 años, OVR 50 y sin club. Elegí nombre, número y posición.
          </Text>
        </View>

        {/* Jersey preview */}
        <View
          testID="jersey-preview-wrapper"
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            padding: spacing[4],
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            gap: spacing[3],
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
            VISTA PREVIA DE CAMISETA
          </Text>
          {/* JerseyPreview renderiza SVG del país con dorsal + apellido.
              Contraste dorsal/jersey verificado AA WCAG por MGC-465.
              Lazy-loaded (MGC-482) para code-split fuera del chunk inicial.
              Placeholder mantiene dimensiones fijas para evitar CLS. */}
          <Suspense
            fallback={
              <View
                testID="jersey-preview-fallback"
                accessibilityElementsHidden
                style={{ width: 160, height: 200, borderRadius: 18, backgroundColor: colors.surface2 }}
              />
            }
          >
            <JerseyPreview
              countryCode={profile.nationalityCode}
              number={profile.number}
              name={profile.name}
              size="md"
              testID="identity-jersey-preview"
            />
          </Suspense>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {profile.position} · OVR 50
          </Text>
        </View>

        {/* Name */}
        <Field label="Nombre">
          <TextInput
            value={profile.name}
            onChangeText={setName}
            placeholder="Ej. Mateo Romero"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={24}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.borderStrong,
                borderRadius: radii.md,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[3],
                fontSize: fontSize.base,
              },
            ]}
            accessibilityLabel="Nombre del jugador"
            testID="input-name"
          />
        </Field>

        {/* Preferred foot */}
        <Field label="Pie hábil">
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            {(['left', 'right', 'both'] as Foot[]).map((f) => {
              const active = profile.preferredFoot === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setPreferredFoot(f)}
                  {...onKeyActivate(() => setPreferredFoot(f))}
                  style={{
                    flex: 1,
                    paddingVertical: spacing[3],
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.borderStrong,
                    backgroundColor: active ? colors.primarySoft : colors.surface,
                    alignItems: 'center',
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={{
                      color: active ? colors.primary : colors.text,
                      fontWeight: fontWeight.semibold,
                      fontSize: fontSize.sm,
                    }}
                  >
                    {f === 'left' ? 'Izquierdo' : f === 'right' ? 'Derecho' : 'Ambos'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        {/* Field map */}
        <Field label="Posición (tap en el campo)">
          <View
            style={{
              aspectRatio: 0.7,
              width: '100%',
              borderRadius: radii.lg,
              borderWidth: 2,
              borderColor: colors.borderStrong,
              backgroundColor: colors.successSoft,
              position: 'relative',
              overflow: 'hidden',
            }}
            accessibilityLabel="Mapa del campo con posiciones"
          >
            {/* Líneas del campo */}
            <View
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: colors.border,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: colors.border,
              }}
            />
            {POSITIONS.map((pos) => {
              const active = profile.position === pos.id;
              return (
                <Pressable
                  key={pos.id}
                  onPress={() => setPosition(pos.id)}
                  {...onKeyActivate(() => setPosition(pos.id))}
                  accessibilityRole="button"
                  accessibilityLabel={`Posición ${pos.label}`}
                  accessibilityState={{ selected: active }}
                  testID={`pos-${pos.id}`}
                  style={{
                    position: 'absolute',
                    left: `${pos.x * 100}%`,
                    top: `${pos.y * 100}%`,
                    transform: [{ translateX: -18 }, { translateY: -18 }],
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    borderWidth: 2,
                    borderColor: active ? colors.textStrong : colors.border,
                    backgroundColor: active ? GROUP_COLOR[pos.group] : colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: active ? '#0A120E' : colors.text,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                    }}
                  >
                    {pos.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        {/* Nationality search */}
        <Field label="Nacionalidad">
          <TextInput
            value={nationalityQuery}
            onChangeText={setNationalityQuery}
            placeholder="Buscar país…"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.borderStrong,
                borderRadius: radii.md,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[3],
                fontSize: fontSize.base,
                marginBottom: spacing[2],
              },
            ]}
            accessibilityLabel="Buscar nacionalidad"
            testID="input-nationality-search"
          />
          <View
            style={{
              maxHeight: 220,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {filteredNationalities.map((n) => {
                const active = profile.nationalityCode === n.code;
                return (
                  <Pressable
                    key={n.code}
                    onPress={() => {
                      setNationality(n.code);
                      setNationalityQuery('');
                    }}
                    {...onKeyActivate(() => {
                      setNationality(n.code);
                      setNationalityQuery('');
                    })}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[3],
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[3],
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      backgroundColor: active ? colors.primarySoft : 'transparent',
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={{ fontSize: 22 }}>{n.flag}</Text>
                    <Text
                      style={{
                        color: active ? colors.primary : colors.text,
                        fontSize: fontSize.base,
                        fontWeight: active ? fontWeight.semibold : fontWeight.regular,
                      }}
                    >
                      {n.name}
                    </Text>
                  </Pressable>
                );
              })}
              {filteredNationalities.length === 0 ? (
                <Text
                  style={{
                    color: colors.textMuted,
                    padding: spacing[3],
                    fontSize: fontSize.sm,
                  }}
                >
                  Sin coincidencias.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </Field>

        </ScrollView>
      {/* MGC-517: footer fijo con el CTA primario. Permanece visible aunque
          el soft keyboard esté abierto o el form se desplace. El botón
          sigue siendo testeable por testID `btn-identity-continue` desde
          el footer (el subtree ya no es scrollable).
          MGC-621: el stepper + el Continue viven ahora en el mismo View
          para garantizar que el `translateY=-keyboardHeight` eleve ambos
          como una unidad sobre el IME. Antes (PR-228) el stepper vivía
          en un View `stepperSticky` separado entre ScrollView y footer,
          pero sobre ZY22G728HN el wrapper colapsaba a height=0 (PR-228) o
          quedaba fuera de la jerarquía accesible. Unificarlos en el footer
          pone el row dentro del flexbox del footer (sin ancestor flex que
          aplique adjustResize), con bounds reales con/sin IME. */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            padding: spacing[4],
            gap: spacing[3],
            transform: [{ translateY: -keyboardHeight }],
          },
        ]}
      >
        {/* MGC-621: stepper movido desde stepperSticky. Wrapper View
            collapsable=false + dimensiones explícitas — ahora mide dentro
            del footer flex (sin ancestor flex del ScrollView que aplicaba
            adjustResize=0). Mantenemos Pressable (no TouchableOpacity,
            memory copero-touchable-opacity-stepper-regression). */}
        <View
          testID="btn-number-row"
          collapsable={false}
          style={{
            flexDirection: 'row',
            gap: spacing[3],
            alignItems: 'center',
            minHeight: 48,
            width: '100%',
            overflow: 'visible',
          }}
        >
          <Pressable
            onPress={() => setNumber(profile.number - 1)}
            accessibilityRole="button"
            accessibilityLabel="Restar número"
            testID="btn-number-minus"
            hitSlop={12}
            collapsable={false}
            {...onKeyActivate(() => setNumber(profile.number - 1))}
            style={[
              styles.stepBtn,
              {
                borderColor: colors.borderStrong,
                borderRadius: radii.md,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.lg }}>−</Text>
          </Pressable>
          <View
            testID="btn-number-display"
            collapsable={false}
            style={[
              styles.numberDisplay,
              {
                borderColor: colors.borderStrong,
                borderRadius: radii.md,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <Text
              style={{
                color: colors.textStrong,
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
              }}
            >
              {profile.number}
            </Text>
          </View>
          <Pressable
            onPress={() => setNumber(profile.number + 1)}
            accessibilityRole="button"
            accessibilityLabel="Sumar número"
            testID="btn-number-plus"
            hitSlop={12}
            collapsable={false}
            {...onKeyActivate(() => setNumber(profile.number + 1))}
            style={[
              styles.stepBtn,
              {
                borderColor: colors.borderStrong,
                borderRadius: radii.md,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.lg }}>+</Text>
          </Pressable>
        </View>
        <Button
          label="Continuar"
          onPress={onContinue}
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canContinue}
          testID="btn-identity-continue"
          accessible
          importantForAccessibility="yes"
          accessibilityHint="Guarda la identidad y abre el dashboard"
        />
      </View>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View style={{ gap: spacing[2] }}>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          letterSpacing: 1,
        }}
      >
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
  // MGC-517: footer fijo bajo SafeAreaView. No se mueve con el contenido
  // scrollable; el CTA primario permanece visible aunque el soft keyboard
  // esté abierto. borderTop sutil separa visualmente del form scrollable.
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    borderWidth: 1,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  numberDisplay: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});