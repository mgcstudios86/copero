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
      {/* MGC-969 — refactor mayor: eliminar el ScrollView externo del
          identity-screen. El patrón previo (MGC-517 → MGC-863 → MGC-937)
          envolvía Header + Jersey + Nacionalidad en un ScrollView raíz con
          `flex:1` y dejaba los wrappers (field-map-section, identity-fixed-
          form, identity-sticky-footer) como hermanos flexShrink:0 del
          kavContent. Ese modelo contenía además un ScrollView anidado
          (lista de países) — dos ScrollViews en la misma pantalla. El
          flex cascade de RN-Android no resuelve de forma estable flex:1
          en el ScrollView raíz cuando el ScrollView anidado está midiendo
          contenido: QA MGC-957 sobre ZY22G728HN 1080x2400 midió ScrollView
          raíz colapsado a h=0 (omitía testID `identity-scroll` del
          uiautomator dump) y hermanos flexShrink:0 con alturas
          incorrectas (field-map-wrapper h=800, identity-footer h=86,
          btn-identity-continue h=45). 8+ iteraciones mobile-developer
          (MGC-826/827/828, MGC-846/848/852, MGC-868/869, MGC-914,
          MGC-926/927/937, PR-280 altura numérica) parchearon flex:1,
          flexDirection:'column', aspectRatio, alignSelf:'stretch' y
          altura numérica sin resolver el rootcause.

          Decisión CTO MGC-969: remover el ScrollView redundante. Arquitectura
          canónica = columna flex de secciones fijas, sin flex:1 en ningún
          hijo, sin ScrollView raíz compitiendo por altura. El único
          ScrollView de la pantalla queda como el anidado de la lista de
          nacionalidades (maxHeight:220), que pasa a llevar el testID
          `identity-scroll` + collapsable={false} para que uiautomator
          lo registre con resource-id estable. Cada sección del kavContent
          lleva flexShrink:0 + altura explícita para que el flex cascade
          no redistribuya altura entre ellas: Header (~110) + Jersey
          (~340) + Nacionalidad TextInput (48) + Nacionalidad ScrollView
          (220) + field-map-section (320 + padding) + identity-fixed-form
          (48+48+padding) + identity-sticky-footer (120+120+padding) suman
          ~1500px y entran en el viewport de ZY22G728HN 1080x2400 (chrome
          SiteHeader+Banner ~210px → ~2190 disponibles).

          Migramos desde el patrón MGC-517 + MGC-863 + MGC-937 al modelo
          "sección fija en columna" para resolver la no convergencia de
          las 8 iteraciones previas (MGC-957 / parent MGC-946). */}
      {/* MGC-1005 (fix MGC-986 + MGC-1000 — rollback MGC-1004 outer ScrollView):
          PR #285 (MGC-1004 / 527f1a6) reintrodujo outer ScrollView con flex:1
          envolviendo field-map-section + identity-fixed-form. QA MGC-998 sobre
          PR #284 midió esos wrappers MISSING en uiautomator dump; PR #285 no
          fue QA-testeado aún pero la hipótesis es la misma: items dentro de
          un ScrollView que overflow off-screen (clipeados por el viewport del
          ScrollView) son excluidos del accessibility tree por RN-Android
          uiautomator. Resultado: field-map-wrapper/input-name-wrapper/btn-
          foot-row invisibles para tapOn y asserts de bounds.

          Rollback MGC-1004: remover el outer ScrollView. Restaurar arquitectura
          MGC-969 (column flex de secciones fijas, sin flex:1 en ningún hijo).
          Y COMPRIMIR el contenido para que las 6 secciones quepan en viewport
          ~1620px disponibles en kavContent (ZY22G728HN 1080x2400 menos
          SiteHeader+Banner ~210px menos bottom safe area 84px):

            identity-header           ~110  (Title + subtítulo + label)
            jersey-preview-wrapper    ~240  (height:240 explícito + md 160x200 + labels)
            identity-nationality      ~280  (TextInput 48 + ScrollView 180 + labels + padding)
            field-map-section         ~340  (label 16 + field-map-wrapper 320 + padding)
            identity-fixed-form       ~250  (Name 110 + Foot 110 + padding)
            identity-sticky-footer    ~280  (stepper 140 + footer 120 + padding)
                                       ----
                                       ~1500  ≤ 1620px viewport ✓

          Cada sección lleva flexShrink:0 + altura explícita (cuando aplique)
          para que el flex cascade no redistribuya altura entre ellas. Sin
          flex:1, sin outer ScrollView, sin competencia por altura entre
          hermanos del kavContent. */}
      {/* Header — sección fija sibling del kavContent (sin ScrollView).
          collapsable={false} garantiza que el ViewGroup entre en la
          jerarquía accesible de uiautomator dump. */}
      <View
        testID="identity-header"
        collapsable={false}
        style={{ gap: spacing[2], padding: spacing[4], flexShrink: 0 }}
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
          Extraído del ScrollView raíz MGC-517 en MGC-969. collapsable={false}
          garantiza jerarquía accesible estable para uiautomator dump.

          MGC-1005: height:240 + maxHeight:240 explícitos. Sin esto, RN-Android
          medía jersey-preview-wrapper h=740 en cold-start (QA MGC-998 sobre
          PR #284) — el wrapper se expandía al tamaño del ScrollView content
          container en lugar de respetar el intrinsic height del JerseyPreview
          md (160x200). El extra de 500dp empujaba las secciones inferiores
          fuera del viewport kavContent y uiautomator las omitía del dump.
          height:240 = md jersey (200) + padding vertical (16+16) + label
          inferior (~14) + gap interno (12) ≈ 258, redondeado a 240 con
          overflow:hidden para forzar el clamp. */}
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
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {profile.position} · OVR 50
          </Text>
        </View>

      {/* MGC-969: sección Nacionalidad como View fijo sibling del kavContent.
          Antes vivía dentro del ScrollView raíz (MGC-517 + MGC-863); al
          refactor mayor, sale del ScrollView raíz junto con Header + Jersey.
          El único ScrollView de la pantalla queda acá dentro (lista de
          países), con testID `identity-scroll` + collapsable={false} para
          que uiautomator dump emita resource-id estable. flexShrink:0 evita
          que el kavContent le robe altura. */}
      <View
        testID="identity-nationality"
        collapsable={false}
        style={{
          padding: spacing[4],
          gap: spacing[2],
          flexShrink: 0,
        }}
      >
        {/* Nationality search — patrón MGC-863: la lista de países vive dentro
            de un ScrollView con maxHeight:220 para permitir scroll interno
            sobre los ~50 países sin desbordar la pantalla. */}
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
              height: 180,
              maxHeight: 180,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {/* MGC-969 — único ScrollView de la pantalla. testID
                `identity-scroll` + collapsable={false} + style explícito
                con height:220 + flexShrink:0 garantiza que uiautomator
                dump registre el nodo accesible con resource-id estable,
                sin depender del flex cascade del kavContent (sin flex:1,
                sin competencia con los hermanos). */}
            <ScrollView
              testID="identity-scroll"
              collapsable={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
              style={styles.scroll}
            >
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

      {/* MGC-969: cierre de identity-nationality (sección fija sibling del
          kavContent). El Field Nacionalidad vive dentro. */}
      </View>
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
                height: 320,
                maxHeight: 320,
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

          Vive entre identity-fixed-form (MGC-751) y el cierre del KeyboardAvoidingView
          (MGC-1005: rollback del outer ScrollView MGC-1004). identity-fixed-form
          queda FUERA a propósito: sus inputs (Name/Foot) no necesitan translateY
          porque su foco ya lo gestiona KAV; solo el stepper+Continue necesita
          esquivar el IME. */}
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
          el footer (el subtree ya no es scrollable).

          MGC-937: remover el doble wrapper collapsable (identity-footer +
          btn-identity-continue-wrap). La combinación de MGC-927 (flexDirection
          column explícito en kavContent) + flex:1 en ScrollView resuelve la
          distribución de altura del flex column; el doble wrapper ya no es
          necesario y de hecho generaba bounds clipped h=45 para el Button en
          QA MGC-907 (el wrapper interno height:120 sin alignSelf:'stretch'
          quedaba con width contenido y el subtree se aplastaba). El footer
          mantiene minHeight:120 + collapsable={false} (MGC-863) y expone el
          Button directamente, garantizando bounds reales height=120 del
          subtree Continue en uiautomator. */}
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
            width: '100%',
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
  // MGC-927: flexDirection:'column' explícito. RN default es column, pero
  // forzar el valor garantiza que el flex cascade asigne altura al
  // ScrollView (identity-scroll) en lugar de distribuir el espacio entre
  // los 3 hermanos (field-map-section, identity-fixed-form, identity-
  // sticky-footer) con flex:0 por default. Sin flexDirection explícito,
  // algunas builds nativas del view manager pueden aplicar flexDirection
  // heredado del padre KeyboardAvoidingView y dejar ScrollView con h=0 →
  // uiautomator omite el testID `identity-scroll` Y, en el build web, el
  // navegador solapa field-map-section sobre los Pressables de la lista
  // nationality (Playwright MGC-444 step 2 reporta "<div data-testid=
  // field-map-section> intercepts pointer events" sobre Argentina).
  kavContent: { flex: 1, flexDirection: 'column' },
  // MGC-969: el ScrollView de la lista de países (identity-scroll) ya no es
  // hijo flex:1 del kavContent — vive dentro de identity-nationality con
  // maxHeight:220 en su View padre. height: 220 + width: '100%' + flexShrink:0
  // fijan dimensiones explícitas para que uiautomator emita bounds reales
  // sin depender del flex cascade. Sin flex:1, sin competencia con los
  // hermanos del kavContent (rootcause del bug MGC-957).
  scroll: {
    height: 220,
    width: '100%',
    flexShrink: 0,
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