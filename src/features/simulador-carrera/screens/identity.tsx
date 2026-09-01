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
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { onKeyActivate } from '@/design/utils/keyboardActivation';
import { useCareerStore } from '@/shared/store/careerStore';
import { POSITIONS, GROUP_COLOR } from '@/features/career/positions';
import { NATIONALITIES } from '@/features/career/nationalities';
import { LEAGUES, leagueNameByCode } from '@/features/career/leagues';
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
  // MGC-955: setter de liga. Persiste junto con nationality/foot.
  const setLeague = useCareerStore((s) => s.setLeague);
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

  // MGC-955: toggle del listado de ligas. Patrón collapsed-button → tap
  // abre ScrollView anidado. Mantener el wrapper collapsable={false} +
  // altura fija (h entre 48 y 200 según AC1) garantiza bounds reales en
  // uiautomator fresh-mount (mismo patrón que nationality-section).
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [leagueQuery, setLeagueQuery] = useState('');
  const filteredLeagues = useMemo(() => {
    const q = leagueQuery.trim().toLowerCase();
    if (!q) return LEAGUES;
    return LEAGUES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q),
    );
  }, [leagueQuery]);
  const selectedLeagueName = leagueNameByCode(profile.leagueCode);

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
      {/* MGC-1178 — outer ScrollView envolviendo TODO el árbol scrollable
          (Header + Jersey + Nacionalidad + Liga + Field map + Fixed form).
          Patrón fix arquitectónico: el ScrollView raíz con flex:1 +
          removeClippedSubviews=false + contentContainerStyle con paddingBottom
          permite que TODAS las secciones se midan dentro del accessibility
          tree de RN-Android (uiautomator dump), no solo las que caben en
          el viewport visible.

          Root cause que QA MGC-1174 + MGC-1179 confirmó: en MGC-969/1152
          (sin outer ScrollView, secciones como Views fijos hermanos) las
          secciones debajo del viewport en ZY22G728HN 1080x2400 se clipean
          al primer layout pass — field-map-section h=36dp, identity-fixed-
          form AUSENTE, btn-identity-continue AUSENTE del DOM. El modelo
          "outer ScrollView cubre solo nationality→field-map" de PR-293
          (MGC-1122 / d2451c1) tampoco resuelve: solo restaura field-map +
          identity-fixed-form pero el resto sigue clipeado.

          Estrategia MGC-1178: outer ScrollView flex:1 envuelve el árbol
          completo, contentContainerStyle con flexGrow:1 + paddingBottom
          240dp garantiza altura intrínseca suficiente para que cada
          sección mida bounds reales. removeClippedSubviews=false +
          collapsable=false en cada testID interior para que
          uiautomator dump no omita el subtree. identity-sticky-footer
          queda FUERA del ScrollView (es el único hijo de kavContent que
          no scrollea) para que el CTA Continue siempre sea visible sin
          scroll y Stepper +/- quede fijo.

          Belt-suspenders: identity-header se comprime a height:110
          explícito (antes crecía a 141dp con subtítulo de 2 líneas) y
          cada sección lleva flexShrink:0 + flexBasis explícito para que
          Yoga no shrinke ninguna. */}
      <ScrollView
        testID="identity-outer-scroll"
        collapsable={false}
        style={styles.outerScroll}
        contentContainerStyle={styles.outerScrollContent}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
      <View
        testID="identity-header"
        collapsable={false}
        style={{
          gap: spacing[2],
          padding: spacing[4],
          flexShrink: 0,
          flexBasis: 110,
          flexGrow: 0,
          height: 110,
          minHeight: 110,
          maxHeight: 130,
          overflow: 'hidden',
        }}
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
      </View>

      {/* Jersey preview — sección fija sibling del kavContent (sin ScrollView).
          height:240 + maxHeight:240 + overflow:hidden fuerzan el clamp al
          intrinsic height del JerseyPreview md (160x200) + padding + labels,
          evitando que RN-Android lo expanda al tamaño del viewport y empuje
          secciones inferiores fuera del dump. Patrón MGC-1005. */}
      <View
        testID="jersey-preview-wrapper"
        collapsable={false}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          marginHorizontal: spacing[4],
          marginBottom: spacing[3],
          padding: spacing[3],
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          gap: spacing[2],
          height: 240,
          maxHeight: 240,
          overflow: 'hidden',
          flexShrink: 0,
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
        <Text
          style={{
            color: colors.textMuted,
            fontSize: fontSize.sm,
            lineHeight: 16,
            height: 16,
            minHeight: 16,
            includeFontPadding: false,
          }}
        >
          {profile.position} · OVR 50
        </Text>
      </View>
      {/* MGC-807: field-map-wrapper extraído a View fijo hermano del ScrollView
          (sibling de `identity-fixed-form`). Patrón canónico MGC-751/PR-254
          (commit 6be789c + 403b380) extendido al field map. Bajo el fold del
          ScrollView (y1 > 1638 en ZY22G728HN 1080x2400) RN-Android clipea los
          bounds al viewport visible y los wrappers collapsable={false} reportan
          h negativo en el primer dump. QA MGC-806 midió field-map-wrapper
          h=-538 dentro del ScrollView; el extracto a View fijo hermano
          garantiza h >= 600 (aspectRatio 0.7 sobre ancho 1048 ≈ 700px) sin
          depender del measure pass del ScrollView. Posicionado entre el
          ScrollView y `identity-fixed-form` (MGC-751) para mantener el orden
          visual original: Header + Jersey (scrollable) → Nacionalidad (fijo)
          → Field map (fijo) → Nombre + Pie (fijo) → Stepper + Continue. NO se
          mete dentro del translateY del `identity-sticky-footer` (MGC-754) — el
          field map no esquiva IME (es tap target, no input de texto). */}
      {/* MGC-843: nationality-section extraída del ScrollView a View fijo
          hermano del ScrollView (sibling de field-map-section y
          identity-fixed-form). Tras PR #260 (MGC-807) el field-map-section
          ocupaba ~1500px del viewport (aspectRatio 0.7 sobre ancho 1048),
          comprimiendo el ScrollView a ~250px de altura en ZY22G728HN 1080x2400
          y dejando Nacionalidad, stepper y Continue clipeados del primer layout
          pass (QA MGC-840 FAIL crítico: identity screen renderizaba SOLO
          field-map + input-name). El listado interno de países mantiene su
          propio ScrollView anidado con `nestedScrollEnabled` para no perder
          scroll dentro del bloque, replicando el patrón canónico MGC-751/
          PR-254 aplicado a Nacionalidad. NO se mete dentro del translateY
          del identity-sticky-footer (MGC-754) — el campo de búsqueda de
          país esquiva el IME solo si gana foco, vía KeyboardAvoidingView
          del wrapper padre. */}
      <View
        testID="nationality-section"
        collapsable={false}
        style={{
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          padding: spacing[4],
          flexShrink: 0,
        }}
      >
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
                    collapsable={false}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[3],
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[3],
                      minHeight: 56,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      backgroundColor: active ? colors.primarySoft : 'transparent',
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    testID={`country-${n.code}`}
                  >
                    <Text style={{ fontSize: 22, lineHeight: 28, includeFontPadding: false }}>{n.flag}</Text>
                    <Text
                      style={{
                        color: active ? colors.primary : colors.text,
                        fontSize: fontSize.base,
                        fontWeight: active ? fontWeight.semibold : fontWeight.regular,
                        lineHeight: 22,
                        includeFontPadding: false,
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
      </View>
      {/* MGC-981: league-selector-wrapper colapsado a height:88 explícito.
          Yoga reporta h=220 sin height (Field label + Pressable minHeight:56
          + padding spacing[4] suma >220 en fresh-mount Android). Patrón
          canónico MGC-848/852/870: height fijo + overflow:hidden + flexShrink:0
          + collapsable={false} + compresión interna para que el contenido
          natural quepa en 88 (padding 8 + label 14 + gap 4 + Pressable 48 + 8
          = 82 con margen). El listado abierto mantiene maxHeight:180 interno.
          testIDs:
            - league-selector-wrapper: contenedor padre.
            - league-selector-label: liga seleccionada visible.
            - league-selector-toggle: Pressable principal que abre/cierra.
            - league-list: ScrollView anidado con las opciones.
            - league-list-item-{code}: cada opción. */}
      <View
        testID="league-selector-wrapper"
        collapsable={false}
        style={{
          height: 88,
          overflow: 'hidden',
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          flexShrink: 0,
        }}
      >
        <Field
          label="Liga de origen"
          wrapperStyle={{ gap: spacing[1] }}
          labelStyle={{ lineHeight: 14 }}
        >
          <Pressable
            testID="league-selector-toggle"
            onPress={() => setLeagueOpen((v) => !v)}
            {...onKeyActivate(() => setLeagueOpen((v) => !v))}
            accessibilityRole="button"
            accessibilityState={{ expanded: leagueOpen }}
            accessibilityHint="Abre la lista de ligas"
            collapsable={false}
            style={{
              minHeight: 48,
              width: '100%',
              borderWidth: 1,
              borderColor: colors.borderStrong,
              borderRadius: radii.md,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.surface,
            }}
          >
            <Text
              testID="league-selector-label"
              style={{
                color: selectedLeagueName ? colors.text : colors.textMuted,
                fontSize: fontSize.base,
                fontWeight: selectedLeagueName ? fontWeight.semibold : fontWeight.regular,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {selectedLeagueName ?? 'Seleccionar liga…'}
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: fontSize.base,
                marginLeft: spacing[2],
              }}
            >
              {leagueOpen ? '▲' : '▼'}
            </Text>
          </Pressable>
          {leagueOpen ? (
            <>
              <TextInput
                value={leagueQuery}
                onChangeText={setLeagueQuery}
                placeholder="Buscar liga…"
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
                    marginTop: spacing[2],
                    marginBottom: spacing[2],
                  },
                ]}
                accessibilityLabel="Buscar liga"
                testID="input-league-search"
              />
              <View
                style={{
                  maxHeight: 180,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" testID="league-list">
                  {filteredLeagues.map((l) => {
                    const active = profile.leagueCode === l.code;
                    return (
                      <Pressable
                        key={l.code}
                        testID={`league-list-item-${l.code}`}
                        onPress={() => {
                          setLeague(l.code);
                          setLeagueOpen(false);
                          setLeagueQuery('');
                        }}
                        {...onKeyActivate(() => {
                          setLeague(l.code);
                          setLeagueOpen(false);
                          setLeagueQuery('');
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
                        <Text
                          style={{
                            color: active ? colors.primary : colors.text,
                            fontSize: fontSize.base,
                            fontWeight: active ? fontWeight.semibold : fontWeight.regular,
                          }}
                        >
                          {l.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {filteredLeagues.length === 0 ? (
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
            </>
          ) : null}
        </Field>
      </View>
      {/* MGC-1086: restaurar MGC-1057 — height:360 + minHeight:360 explícitos
          en field-map-section. MGC-1073 (92e9975) revirtió el fix MGC-1057
          removiendo height:360 + minHeight:360 y reemplazando height:320
          del wrapper por aspectRatio:1.4, lo que producía bounds
          dependientes del ancho. En ZY22G728HN 1080px el wrapper medía
          ~770px pero la section colapsada a 397px lo clipeaba. Resultado
          QA MGC-1062 sobre build-MGC-1057-2-ce9295e.apk: field-map-section
          397px (159dp) vs 900px esperado, 7 de 12 posiciones con bounds
          invertidos. Patrón canónico MGC-916 / 0141fb0 / MGC-1045 / MGC-1057.

          MGC-1152: añadir flexBasis:360 + flexGrow:0 al field-map-section
          para que Yoga respete la altura declarada aunque el parent
          kavContent flex:1 intente encogerla. Belt-suspenders junto al
          fix de field-map-wrapper (flexBasis:320 + flexGrow:0) que
          garantiza h=320dp en ZY22G728HN density 400. */}
      <View
        testID="field-map-section"
        collapsable={false}
        style={{
          height: 360,
          minHeight: 360,
          flexBasis: 360,
          flexGrow: 0,
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          padding: spacing[4],
          flexShrink: 0,
        }}
      >
        <Field label="Posición (tap en el campo)">
          {/* MGC-1086: restaurar MGC-1057 — height:320 + flexShrink:0 +
              alignSelf:'stretch' en field-map-wrapper (canónico 0141fb0 /
              MGC-916). Sin altura fija el wrapper colapsa junto con la
              section padre y las posiciones absolutas (top:Y%) se
              renderizan fuera del viewport visible con bounds invertidos.

              MGC-1152: PR-298 midió wrapper h=250dp vs AC 320±10dp en
              APK build-PR-294-1-c068d67. El parent field-map-section mide
              309dp (en lugar de 360dp declarados) por shrink del outer
              ScrollView (MGC-1122) + Field wrapper flexShrink:1 default.
              Root cause: APK build-MGC-1152-1-3f0e485.apk contiene bundle
              JS stale SHA 9ffd3894 (PR-285 era) — APK source SHA coincide
              con commit pero el bundle es pre-PR-298. QA MGC-1169 reportó
              field-map-wrapper AUSENTE + field-map-section 91px en dump.

              Fix robusto: añadir flexBasis:320 + flexGrow:0 al inline
              style del field-map-wrapper para que Android Yoga respete la
              altura declarada aunque el parent esté siendo constrained.
              Canónico MGC-916/PR-287/0141fb0 (flexBasis + flexGrow:0
              fuerzan altura ignorando shrink cascade). maxHeight:320 +
              flexShrink:0 + alignSelf:'stretch' quedan como belt-suspenders. */}
          <View
            testID="field-map-wrapper"
            collapsable={false}
            style={{
              height: 320,
              maxHeight: 320,
              width: '100%',
              flexBasis: 320,
              flexGrow: 0,
              borderRadius: radii.lg,
              borderWidth: 2,
              borderColor: colors.borderStrong,
              backgroundColor: colors.successSoft,
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
              alignSelf: 'stretch',
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
            style={{ minHeight: 48, width: '100%' }}
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
              minHeight: 48,
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
      </ScrollView>
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
          el footer (el subtree ya no es scrollable). */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            padding: spacing[4],
          },
        ]}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
  wrapperStyle,
  labelStyle,
}: {
  label: string;
  children: React.ReactNode;
  wrapperStyle?: ViewStyle;
  labelStyle?: TextStyle;
}) {
  const { colors, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View style={[{ gap: spacing[2] }, wrapperStyle]}>
      <Text
        style={[
          {
            color: colors.textMuted,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            letterSpacing: 1,
          },
          labelStyle,
        ]}
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
  // MGC-1178: outer ScrollView que envuelve todo el árbol scrollable.
  // flex:1 le da el alto del padre kavContent (que es flex:1 del KAV),
  // y contentContainerStyle con flexGrow:1 + paddingBottom 240dp garantiza
  // que el content mide su altura intrínseca total y deja espacio para
  // que el sticky-footer quede visible al final del scroll.
  outerScroll: {
    flex: 1,
  },
  outerScrollContent: {
    flexGrow: 1,
    paddingBottom: 240,
  },
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
});