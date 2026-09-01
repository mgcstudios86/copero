import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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

  // MGC-754: en ZY22G728HN 1080x2400 con `softwareKeyboardLayoutMode: "pan"`
  // en app.json, el paddingBottom dinamico sobre kavContent (MGC-610) NO
  // empujaba el sticky stepper arriba del IME — QA second pass MGC-752 sobre
  // PR #252 encontro btn-number-plus en y=1807 con IME y=1560-2310 (tap
  // interceptado por IME). El flex layout entre ScrollView + stepperSticky
  // (flexShrink:0, minHeight:120) + footer no redistribuye la altura
  // reducida de forma consistente: stepperSticky queda bajo el IME porque
  // el flex shrink se aplica a ScrollView y footer, no al stepper sticky.
  //
  // Estrategia definitiva: wrap stepperSticky + footer en un View padre
  // `identity-sticky-footer` con `transform: [{ translateY: -keyboardOffset }]`
  // (Android only). translateY es independiente del flex layout del padre
  // y empuja los dos elementos juntos sobre el IME sin depender de
  // flexShrink calculations ni del comportamiento de `adjustPan` del OS.
  // Restamos `insets.bottom` para no doble-contar la safe area del gesture
  // nav bar (84px en ZY22G728HN). En iOS, KeyboardAvoidingView maneja el
  // offset nativamente — translateY alli es 0 para evitar doble push.
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardOffset(Math.max(0, e.endCoordinates.height - insets.bottom));
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardOffset(0);
      },
    );
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
    // MGC-633 — encadenar un `requestAnimationFrame` + `setTimeout 250`
    // al callback de `runAfterInteractions`. En ZY22G728HN + PR-clean
    // (commit 282f497), el rebote se reproduce ~5 s después del tap
    // (no 645 ms como en MGC-532): la app monta `dashboard-screen`
    // con la identidad persistida correctamente y luego vuelve sola a
    // `home-screen`. La causa raíz parece ser una race entre el
    // settle del lazy chunk del dashboard (~1 s) y el settle del
    // reanimated del dismiss del teclado que `runAfterInteractions`
    // no garantiza al 100 % en builds nativos (mientras que en web
    // el settle es síncrono). Diferir 250 ms adicionales dentro del
    // callback le da al chunk del dashboard tiempo a montar su árbol
    // + al splash screen plugin a terminar su fade-out nativo antes
    // de empujar el `router.replace`. Sin el setTimeout, el push
    // entraba en el mismo tick de la animación del IME y Expo Router
    // podía volver atrás si el stack del simulador-carrera no estaba
    // todavía anclado al top del root stack.
    //
    // Además usamos `router.replace` en vez de `push` para que identity
    // no quede en el back-stack post-commit (memory pressure + UX más
    // limpio: back desde dashboard va a home, no al form ya enviado).
    commitIdentity();
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          router.replace('/simulador-carrera/dashboard');
        }, 250);
      });
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      {/* MGC-610: wrapper View con paddingBottom dinamico. Cuando el IME
          se abre, keyboardOffset sube al alto del teclado menos el inset
          inferior (84px en ZY22G728HN). Esto empuja el stepper sticky y el
          footer (Continue) arriba del keyboard. NO se aplica al SafeAreaView
          directo porque edges=['bottom'] ya consume el inset del gesture
          nav bar — sumarlos darian doble padding. En iOS, KeyboardAvoidingView
          maneja el offset nativamente, por eso el padding solo se aplica en
          Android. */}
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
      <View style={[styles.kavContent]}>
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
          y con teclado abierto quedaba fuera del fold visible.

          MGC-751: input-name-wrapper y btn-foot-row se extraen del
          ScrollView (ver <View testID="identity-fixed-form"/> abajo). El
          primer layout pass de RN-Android dentro de un ScrollView clipea
          los bounds de los hijos al viewport visible (en ZY22G728HN 1080x2400
          con SiteHeader + Banner arriba, viewport bottom ≈ y=1638). Resultado
          QA MGC-711: input-name-wrapper h=-22 y btn-foot-row h=-270 aunque
          wrapper tuviera collapsable={false} + minHeight:48 + overflow:visible.
          Mismo patrón que PR #223 ea57f8b + PR #252 0b41800 que sacaron el
          stepper +/- del ScrollView para resolver MGC-585 / MGC-744: el
          stepper pasó de h=0 a bounds reales porque vive en un View fijo
          entre ScrollView y footer, sin pasar por el measure pass del
          ScrollView. Aquí replicamos ese patrón en los wrappers que QA
          necesita testear por testID estable. */}
      <ScrollView
        testID="identity-scroll"
        contentContainerStyle={[styles.container, { gap: spacing[5], padding: spacing[4], paddingBottom: spacing[4] }]}
        keyboardShouldPersistTaps="handled"
        // MGC-863: removeClippedSubviews={false} evita que RN-Android
        // elimine del árbol nativo accesible los hijos del ScrollView
        // cuando se abre/cierra el IME. Patrón canónico PR #253 (b21e8f6).
        removeClippedSubviews={false}
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

        {/* Nationality search (DENTRO del ScrollView — patrón canónico MGC-863). */}
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
      {/* MGC-916: field-map-wrapper extraído a View fijo hermano del
          ScrollView (sibling de `identity-fixed-form` debajo). Patrón
          canónico 0141fb0 / MGC-826: el field map vivía dentro del
          ScrollView y bajo el fold (y1 > scroll y2 en ZY22G728HN) RN-Android
          clipeaba los bounds al viewport visible en el primer layout pass
          (QA MGC-840 midió pos-XX bounds invertidos height=-538 a -1094).
          Extrayéndolo a View fijo con height:320 + overflow:hidden
          garantizamos bounds reales sin depender del measure pass del
          ScrollView. styles.fieldMapWrapper define height:320 + overflow:
          hidden + flexShrink:0 + alignSelf:'stretch' (canónico 0141fb0).
          NO se mete dentro del translateY del `identity-sticky-footer`
          (MGC-754) — el field map no esquiva IME (es tap target, no input
          de texto). BorderColor/backgroundColor se aplican inline para
          preservarlos (regresión MGC-828 / bf88e58 documentada). */}
      <View
        testID="field-map-section"
        collapsable={false}
        style={{
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          padding: spacing[4],
          flexShrink: 0,
        }}
      >
        <Field label="Posición (tap en el campo)">
          <View
            testID="field-map-wrapper"
            collapsable={false}
            style={[
              styles.fieldMapWrapper,
              {
                borderRadius: radii.lg,
                borderColor: colors.borderStrong,
                backgroundColor: colors.successSoft,
              },
            ]}
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
                  collapsable={false}
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
      </View>
      {/* MGC-751: section fija fuera del ScrollView con los wrappers que QA
          necesita testear (input-name-wrapper + btn-foot-row). Mismo patrón
          que el stepper sticky de MGC-585/PR-223 (ea57f8b) y MGC-744/PR-252
          (0b41800): vivir fuera del ScrollView evita el clipping del measure
          pass de RN-Android que reportaba bounds h=-22 / h=-270 fresh-load
          en ZY22G728HN 1080x2400. El View padre lleva collapsable={false}
          para garantizar que el subtree entra en la jerarquía nativa
          reportada por uiautomator, replicando el snippet canónico de
          MGC-594/PR-227 (commit 6be789c) — ahora aplicado a la sección
          completa, no solo al wrapper interno.

          Posicionado entre el ScrollView (Header + Jersey + Nacionalidad) y
          el stepper sticky (número), de modo que el usuario ve:
          Header+Jersey arriba → scroll para Nacionalidad → Field map (fijo)
          → Name + Foot siempre visibles → Stepper + Continue. Los wrappers
          quedan en zona fija (y ≥ 1660 según bounds del layout, fuera del
          viewport bottom del ScrollView ~y=1638) donde el measure pass NO
          clipea sus bounds.

          Queda FUERA del wrapper identity-sticky-footer (MGC-754) porque el
          translateY de IME avoidance solo aplica al stepper+Continue; los
          inputs Name/Foot no necesitan esquivar el teclado (su input foco
          ya se gestiona vía KAV). */}
      <View
        testID="identity-fixed-form"
        collapsable={false}
        style={{
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          padding: spacing[4],
          gap: spacing[4],
          flexShrink: 0,
        }}
      >
        {/* Name — MGC-686: wrapper View collapsable=false + minHeight:48 +
            TextInput collapsable=false. El patrón snippet completo vive
            ahora en zona fija (no ScrollView) para bounds reales en
            uiautomator fresh-load. */}
        <Field label="Nombre">
          <View
            testID="input-name-wrapper"
            collapsable={false}
            style={{ height: 48, minHeight: 48, width: '100%', overflow: 'visible' }}
          >
            <TextInput
              value={profile.name}
              onChangeText={setName}
              placeholder="Ej. Mateo Romero"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={24}
              collapsable={false}
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
          </View>
        </Field>

        {/* Preferred foot — MGC-632: wrapper View collapsable=false +
            minHeight:48. Pressable hijos sin collapsable={false} porque
            RN-Android mide bounds reales desde el wrapper padre cuando
            vive fuera del ScrollView (verificado por QA MGC-744 sobre
            stepper). Si QA reporta flake en los Pressables individuales
            (Izquierdo/Derecho/Ambos), replicar el patrón canónico del
            stepper (collapsable={false} en cada Pressable hijo). */}
        <Field label="Pie hábil">
          <View
            testID="btn-foot-row"
            collapsable={false}
            style={{
              flexDirection: 'row',
              gap: spacing[2],
              width: '100%',
              height: 48,
              minHeight: 48,
              overflow: 'visible',
              alignItems: 'center',
            }}
          >
            {(['left', 'right', 'both'] as Foot[]).map((f) => {
              const active = profile.preferredFoot === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setPreferredFoot(f)}
                  {...onKeyActivate(() => setPreferredFoot(f))}
                  testID={`btn-foot-${f === 'left' ? 'izq' : f === 'right' ? 'der' : 'ambos'}`}
                  collapsable={false}
                  style={{
                    flex: 1,
                    paddingVertical: spacing[3],
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.borderStrong,
                    backgroundColor: active ? colors.primarySoft : colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
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
      </View>
      {/* MGC-754: wrap stepperSticky + footer en `identity-sticky-footer` para
          aplicar translateY simultáneo cuando IME abre. translateY es
          independiente del flex layout del padre y empuja los dos elementos
          (stepper +/- + Continue) arriba del IME sin depender de flexShrink
          calculations. collapsable=false garantiza bounds reales en
          uiautomator para el wrapper padre. testID permite hook Maestro
          para asserts de subtree sticky-footer entero.

          Vive entre identity-fixed-form (MGC-751) y el cierre del KeyboardAvoidingView.
          identity-fixed-form queda fuera a propósito: sus inputs (Name/Foot)
          no necesitan translateY porque su foco ya lo gestiona KAV. */}
      <View
        testID="identity-sticky-footer"
        collapsable={false}
        style={[
          Platform.OS === 'android' && keyboardOffset > 0
            ? { transform: [{ translateY: -keyboardOffset }] }
            : null,
        ]}
      >
      {/* MGC-585 + MGC-744: stepper +/- en sticky footer entre el form scrollable
          y el botón Continuar. MGC-585 (PR #223 / ea57f8b) extrajo el row del
          ScrollView; MGC-744 agrega el wrapper canónico collapsable=false +
          height:48 + minHeight:48 sobre el row padre porque, aunque los
          Pressable hijos tuvieran collapsable={false}, en cold-start fresh
          mount (no resume from dashboard) el View row padría colapsar a
          wrap_content=0 en el primer layout pass de RN-Android y uiautomator
          reportaba bounds=[40,1907][150,1907] height=0 — invisible=true y
          Maestro tapOn saltaba silenciosamente. El wrapper colapsable=false
          + altura explícita evita el colapso a ViewGroup h=0 desde el primer
          frame del identity cold-start. testID row permite hook adicional en
          Maestro para asserts de subtree. */}
      <View
        testID="btn-number-sticky"
        collapsable={false}
        style={[
          styles.stepperSticky,
          {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            padding: spacing[4],
          },
        ]}
      >
        <Text
          style={{
            color: colors.textMuted,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            letterSpacing: 1,
            marginBottom: spacing[2],
          }}
        >
          NÚMERO (1–99)
        </Text>
        <View
          testID="btn-number-row"
          collapsable={false}
          style={{
            flexDirection: 'row',
            gap: spacing[3],
            width: '100%',
            height: 48,
            minHeight: 48,
            overflow: 'visible',
            alignItems: 'center',
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
      </View>
      {/* MGC-517: footer fijo con el CTA primario. Permanece visible aunque
          el soft keyboard esté abierto o el form se desplace. El botón
          sigue siendo testeable por testID `btn-identity-continue` desde
          el footer (el subtree ya no es scrollable). MGC-863: doble
          wrapper collapsable={false} (identity-footer + btn-identity-
          continue-wrap) alrededor del Button. Patrón canónico 6be789c /
          MGC-594 aplicado a Pressable: el Button hereda wrap_content del
          Text label en el primer layout pass de RN-Android, ignorando la
          minHeight del wrapper padre. El wrapper interno collapsable=
          {false} + height:120 explícito rompe el ciclo de wrap_content y
          garantiza bounds reales (h=120) en uiautomator para el subtree
          del Pressable. */}
      <View
        testID="identity-footer"
        collapsable={false}
        style={[
          styles.footer,
          {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            padding: spacing[4],
            minHeight: 120,
            overflow: 'visible',
            flexShrink: 0,
          },
        ]}
      >
        <View
          testID="btn-identity-continue-wrap"
          collapsable={false}
          style={{ height: 120, overflow: 'visible', flexShrink: 0 }}
        >
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
      </View>
      </View>
      </View>
      </KeyboardAvoidingView>
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
  // MGC-610: KAV ocupa todo el alto del SafeAreaView para que el padding
  // de iOS afecte al split ScrollView + footer. En Android el padding
  // se aplica via kavContent para no chocar con adjustResize del OS.
  kav: { flex: 1 },
  // MGC-610: wrapper interior con paddingBottom dinamico (Android). El
  // padding empuja el stepper sticky + footer arriba del IME sin tocar
  // el SafeAreaView edges=['bottom'].
  kavContent: { flex: 1 },
  container: {},
  // MGC-517: footer fijo bajo SafeAreaView. No se mueve con el contenido
  // scrollable; el CTA primario permanece visible aunque el soft keyboard
  // esté abierto. borderTop sutil separa visualmente del form scrollable.
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // MGC-585 + MGC-612: contenedor sticky del stepper +/- sobre el Continue.
  // borderTop sutil separa visualmente del ScrollView. minHeight fija el
  // piso vertical para que RN-Android no mida wrap_content=0 en el primer
  // layout pass (cold start sin IME), lo que dejaba btn-number-plus/minus
  // con bounds height=0 en uiautomator. flexShrink:0 evita que el wrapper
  // sea comprimido por el ScrollView/footer cuando compiten por altura.
  stepperSticky: {
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 120,
    flexShrink: 0,
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
  // MGC-916: wrapper exterior del field-map. Patrón canónico 0141fb0.
  // height fijo 320 + overflow:hidden garantiza bounds reales en el primer
  // layout pass (RN-Android cold start medía 1428px con aspectRatio 0.7 +
  // width:'100%' inline sobre 1080×2400 — QA MGC-906 FAIL). flexShrink:0
  // evita que un padre flex lo expanda; alignSelf:'stretch' fuerza
  // width:full-width sin declarar width:'100%' (eliminado en MGC-916 para
  // evitar conflicto con alignItems del padre flex). borderWidth + position
  // pasan a styles (0141fb0) — borderColor y backgroundColor siguen inline
  // para preservar patrón MGC-828 / bf88e58.
  fieldMapWrapper: {
    height: 320,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    alignSelf: 'stretch',
  },
});