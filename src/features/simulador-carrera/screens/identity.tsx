import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
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
import { useLocale } from '@/i18n/locale-context';
import { POSITIONS, GROUP_COLOR } from '@/features/career/positions';
import { NATIONALITIES } from '@/features/career/nationalities';
// MGC-1585: league-selector-wrapper extraído de /identity. La selección de
// liga ocurre exclusivamente en /academy paso 3 (cada club expone su league).
// El campo leagueCode del store queda como default '' y se mantiene el setter
// `setLeague` por compat con storage migrado (MGC-1501 internal track).
import { isIdentityComplete } from '@/features/career/identity-state';
import type { Foot, PositionGroup } from '@/types/career';

// MGC-1448 — filas de nacionalidad visibles sin query. Ver el presupuesto de
// contenido documentado en `filteredNationalities`: con las 33 inline el árbol
// del scroll sumaba ≈8570px y dejaba identity-fixed-field-map ≈6000px bajo el
// fold (fuera del alcance de cualquier swipe fijo y del hierarchy dump de QA).
// Las 5 primeras cubren los testIDs del contrato E2E:
// country-ARG / BR / UY / CL / CO.
const NATIONALITY_FRESH_LIMIT = 5;

// MGC-1628 / WF1 — chips de posición (wireframe §WF1). 4 grupos en una
// sola fila horizontal. Cada chip tiene un `defaultPos` que es el
// representante del grupo para guardar en `profile.position` cuando se
// selecciona (F1 no modela sub-posiciones; el árbol semanal posicional
// vive en F2 / MGC-1628 §L4 + MGC-1675). `ids` cubre todos los
// representatives del grupo para que el chip siga seleccionado si el
// profile hidrata con una sub-posición legacy (LH/RW → ST, etc.).
type PositionChip = {
  id: string;
  label: 'Gk' | 'Def' | 'Mid' | 'Fwd';
  group: PositionGroup;
  defaultPos: (typeof POSITIONS)[number]['id'];
  ids: (typeof POSITIONS)[number]['id'][];
};
const POSITION_CHIPS: PositionChip[] = [
  { id: 'GK', label: 'Gk', group: 'goalkeeper', defaultPos: 'GK', ids: ['GK'] },
  { id: 'CB', label: 'Def', group: 'defense', defaultPos: 'CB', ids: ['LB', 'CB', 'RB'] },
  { id: 'CAM', label: 'Mid', group: 'midfield', defaultPos: 'CAM', ids: ['LM', 'CAM', 'RM', 'CM', 'CDM'] },
  { id: 'ST', label: 'Fwd', group: 'attack', defaultPos: 'ST', ids: ['LW', 'ST', 'RW'] },
];

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
  // MGC-1628 / WF1 — apellido separado del nombre. Mismo patrón que
  // `setName`: spread inmutable del profile, persistencia async best-effort.
  const setLastName = useCareerStore((s) => s.setLastName);
  // MGC-1628 / WF1 — edad editable 16-35 en el form. El motor sigue
  // incrementando `profile.age` cada temporada (season.ts:122) — este
  // setter sólo opera durante el alta.
  const setAge = useCareerStore((s) => s.setAge);
  // MGC-1760 — ref al TextInput para que el Pressable wrapper (con hitSlop
  // WCAG 2.5.5) pueda disparar foco en tap perimetral. hitSlop en TextInput
  // nativo Android no extiende el hitbox de focus.
  const ageInputRef = useRef<TextInput>(null);
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

  // MGC-1534: subscribirse al contexto de locale para re-renderizar el form
  // completo al cambiar idioma. Antes las strings quedaban en espanol aunque
  // el LanguageSwitcher marcara EN/中文 seleccionado.
  const { t } = useLocale();

  const [nationalityQuery, setNationalityQuery] = useState('');
  // MGC-1503 — UX-005 P0 del audit MGC-1500. Por defecto la pantalla cape el
  // listado a las 5 primeras (MGC-1448) para no romper el budget vertical del
  // scroll (33 inline ≈6000px bajo el fold). El usuario puede tap "Ver todas
  // (N)" abajo del bloque y renderizar las 33 explícitamente; el listado
  // extendido vive dentro del outer ScrollView (paddingBottom:240 ya
  // reservado en MGC-1428) y el sticky-footer sigue opaco.
  const [nationalityExpanded, setNationalityExpanded] = useState(false);
  const filteredNationalities = useMemo(() => {
    const q = nationalityQuery.trim().toLowerCase();
    if (!q) {
      // MGC-1448 — sin query Y sin expandir mostramos solo las 5 primeras
      // (AR/BR/UY/CL/CO) + la seleccionada. Presupuesto de contenido medido
      // en ZY22G728HN (viewport del scroll = 1832px = 732.8dp @ density 400):
      //   header 150 + jersey 300 + nationality (32 pad + 20 label + 56 input
      //   + N*57 por fila) + league 88 + field-map 320 + form 340 + pad 240.
      // Con las 33 nacionalidades inline el contenido suma ≈3430dp ≈8570px:
      // identity-fixed-field-map cae ≈6000px por debajo del fold, así que
      // NINGÚN swipe fijo de 900px lo trae al dump (QA MGC-1450/1452 lo
      // reportó AUSENTE: estaba renderizado, pero a 7 swipes de distancia).
      // Con 5 filas el contenido baja a ≈1830dp: field-map queda a UN swipe
      // del fold y el form entero es alcanzable con scrollUntilVisible en
      // 1-2 pasos.
      // El search sigue cubriendo las 33 al tipear (query no vacía → filtro
      // completo), que es el flujo real del usuario.
      // MGC-1503 — al expandir (Pressable "Ver todas (33)") se renderiza la
      // lista completa. El usuario eligió explícitamente ver más, así que el
      // scroll extra es intencional. El test plan E2E sigue ejercitando las
      // 5 primeras (testIDs country-ARG/BR/UY/CL/CO), que viven como las
      // primeras 5 entradas en NATIONALITIES y conservan su contrato.
      if (!nationalityExpanded) {
        const head = NATIONALITIES.slice(0, NATIONALITY_FRESH_LIMIT);
        // MGC-1769 — nationalityCode es `string | null`. Sin selección
        // activa, no se filtra la lista (selected=undefined → OK).
        const selected = profile.nationalityCode
          ? NATIONALITIES.find((n) => n.code === profile.nationalityCode)
          : undefined;
        return selected && !head.some((n) => n.code === selected.code)
          ? [...head, selected]
          : head;
      }
      return NATIONALITIES;
    }
    return NATIONALITIES.filter(
      (n) => n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q),
    );
  }, [nationalityQuery, profile.nationalityCode, nationalityExpanded]);

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
    // limpio: back desde team-select va a home, no al form ya enviado).
    // MGC-1648 — WF2 team-select obligatorio en el alta. El push va a
    // `/simulador-carrera/team-select` en vez del dashboard; ese screen
    // setea `profile.club` y re-navega al dashboard tras el CTA
    // «Empezar carrera». El comentario MGC-532 / MGC-633 sobre el defer
    // sigue aplicando al nuevo target (el chunk lazy del team-select
    // también compite con el settle del IME dismiss).
    commitIdentity();
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          router.replace('/simulador-carrera/team-select');
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
      {/* MGC-1452 — rootcause fix sobre PR-352 FAIL (MGC-1450). PR-352
          (commit 39b5bdf, build-PR-352-1-39b5bdf.apk) mantuvo el patrón
          flex:1 ScrollView + sticky-footer absolute + contentContainer
          flexGrow:1 paddingBottom:240 — pero el measure pass de RN-Android
          colapsó el ScrollView wrapper a h=1431px en ZY22G728HN 1080×2400
          (gap 401px vs viewport 1832px), dejando identity-fixed-field-map
          AUSENTE del hierarchy dump fresh-mount
          (clipping de hijos bajo el measure pass). countries-CL/US
          INVERTIDOS porque caen en el overlap del sticky-footer top
          y=1607 (altura real 209.2dp, no 240dp esperado).
          Patrón PR-351 (b52c341, MGC-1440 PASS): anclar ScrollView con
          position:absolute top:0/left:0/right:0/bottom:0 dentro de un
          kavContent position:relative garantiza que el wrapper del
          ScrollView ocupe EXACTAMENTE los 1832px del kavContent,
          independientemente del measure pass del contentContainer.
          Saca identity-fixed-field-map del ScrollView (sibling) para
          garantizar su presencia en el hierarchy dump fresh-mount sin
          depender de la posición del scroll — patrón MGC-751/811/807
          original. countries-* siguen como hijos directos del scroll
          (Option B fiel MGC-1411) con paddingBottom:240 que despeja el
          overlap del footer para country-CO/CL/US accesibles tras scroll
          completo. */}
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
      {/* MGC-1274 — fix outer ScrollView tree clipping sobre PR-302 (a9ee2fc).
          QA MGC-1273 midió identity-screen bounds h=1832 y TOTAL natural height
          ~1300dp > viewport disponible 709dp en ZY22G728HN 1080×2400 density
          400 (1080×960dp). Sin scroll, las secciones debajo del fold
          (field-map-section, identity-fixed-form, identity-sticky-footer)
          quedaban clipeadas del render tree y AUSENTES del UIAutomator dump.
          Patrón canónico MGC-1257 (commit f6bfdc8, APK 03d898fb...d94526,
          bundle 56ba46ab...c8f7c923, ref MGC-1178 433281f/fa99ac4): outer
          ScrollView flexGrow:1 cubre TODO el árbol scrollable
          (identity-header + Jersey + nationality-section + field-map-section
          + identity-fixed-form); `identity-sticky-footer` flexBasis:240
          flexGrow:0 flexShrink:0 es el ÚNICO sibling del ScrollView — siempre
          visible al fondo con stepper +/- y Continue. collapsable={false} +
          removeClippedSubviews={false} en el ScrollView para mantener
          resource-id estable en UIAutomator. field-map-wrapper
          (MGC-916/MGC-1152 canónico) lleva height:320 + flexBasis:320 +
          flexGrow:0 contra shrink cascade del measure pass del ScrollView.
          Spec MGC-1143 320±10dp. MGC-1299 revierte el height:380 que PR-320
          (MGC-1286) había introducido como belt-suspenders — 380dp queda
          60dp por encima del spec histórico.
          Refs: [[mgc1257-outer-scrollview-tree]], MGC-711, MGC-751, MGC-806,
          MGC-807, MGC-811, MGC-840, MGC-843, MGC-1016, MGC-1086, MGC-1222,
          MGC-1299. */}
      {/* MGC-1428 — opción B (MGC-1411) re-aplicada fielmente. outer ScrollView
          cubre TODO el árbol scrollable. field-map-section es SIBLING directo
          del outer scroll (hermano visible), nationality sin ScrollView anidado
          (lista plana, maxHeight controlada, países como hijos directos del
          scroll padre), paddingBottom:240 para que country-CO no invierta
          bounds contra el sticky-footer (y=1530). Sin padding, los últimos
          países caen fuera del viewport natural del ScrollView y RN-Android
          clipea sus bounds contra el sticky-footer top → bottom < top. */}
      {/* MGC-1428 — ScrollView flex:1 (no flexShrink:1) + sticky-footer
          position:absolute bottom:0 (overlap, no consume flex). Spec MGC-1411
          opción B fiel: outer ScrollView reclama TODO el alto del kavContent
          (flexBasis:0 con {flex:1}) antes que Yoga distribuya entre siblings.
          sticky-footer absolute no compite por altura, solo overlapea.
          paddingBottom:240 en scrollContent despeja el area del overlap para
          que country-CO (último país) no invierta bounds contra el footer top. */}
      <ScrollView
        testID="identity-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        collapsable={false}
        removeClippedSubviews={false}
      >
      <View
        testID="identity-header"
        collapsable={false}
        style={{ gap: spacing[2], padding: spacing[4], flexShrink: 0 }}
      >
        {/* MGC-1628 / WF1 + FX1-B6 / MGC-1739 P1-2 — header reorganizado.
            Antes (PR-427): eyebrow "COPERO · NUEVA CARRERA" + title "Creá tu
            jugador" + subtitle "Paso 1 de 2 — Tu jugador". El eyebrow competía
            visualmente con el SiteHeader global (brand "Copero" + nav
            "Simulador de carrera" + badge de versión MGC-1506): dos marcas a
            corta distancia, mismo letterSpacing small-caps. El catálogo
            MGC-1739 P1-2 reportó "Title 'identity' del header duplica versión
            del site-header" como regresión visible.

            Fix: drop eyebrow Text. SiteHeader ya provee contexto de marca y
            estado. title + subtitle se mantienen; title conserva su guardia
            anti-truncado (FX1-B2 PR #449) y el subtitle sigue siendo el step
            indicator explícito accesible para screen readers. `identity.eyebrow`
            queda en copy.ts (es/en/zh-CN) por si se reutiliza en otro flow,
            pero no se monta acá. */}
        <View style={{ gap: spacing[2] }}>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontFamily: fontFamily.display,
              fontWeight: fontWeight.bold,
              lineHeight: fontSize['2xl'] * lineHeight.tight,
            }}
            accessibilityRole="header"
            // FX1-B2 / MGC-1739 — guardia contra truncado de título
            // (P0-3 catálogo: "Define tu identidad" → "Define tu identida[d]"
            // en APK PR-420 vc=109). El copy actual ES "Creá tu jugador"
            // (PR-427 MGC-1628, 17 chars a 30px Poppins bold ≈ 306px en
            // viewport 1080px) cabe holgado, pero blindamos contra futuras
            // traducciones largas (zh-CN "定义你的身份" = 6 chars, en-US
            // "Define your identity" = 21 chars): una sola línea, ajuste
            // automático de tamaño si excediera. numberOfLines={1} evita
            // también que crezca verticalmente y desplace el field-map.
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {t('identity.title')}
          </Text>
          <Text
            style={{ color: colors.textMuted, fontSize: fontSize.base }}
            numberOfLines={2}
          >
            {t('identity.subtitle')}
          </Text>
        </View>
      </View>

      {/* MGC-1532 — P0-BLOCKER: identity-fixed-form PROMOVIDO a SEGUNDO hijo
          del outer ScrollView (entre identity-header y nationality-section).
          Causa raíz del walk E2E MGC-1499 sobre v0.1.1(16): `isIdentityComplete`
          (src/features/career/identity-state.ts) exige SOLO
          `name.trim().length >= 2` — `number` arranca en 9 (válido) y
          position/nationality/foot tienen default. O sea: el nombre es el
          ÚNICO gate del botón Continuar. Pero identity-fixed-form era el
          ÚLTIMO hijo del scroll (y≈1208dp de un viewport de 732.8dp), así que
          en cold-start el usuario veía la camiseta con el placeholder estático
          "TU NOMBRE" (jersey-preview), tocaba país + número, y Continuar seguía
          gris sin ninguna pista de que faltaba scrollear ~475dp para encontrar
          el EditText. QA reportó el EditText input-name AUSENTE del dump
          fresh-mount (qa_id2.xml: sólo el TextView estático `jersey-name`).

          Layout resultante en ZY22G728HN 1080×2400 density 400 (1dp = 2.5px),
          viewport del scroll 732.8dp, footer opaco top = 492.8dp (1530px):
            identity-header          y=0      → y≈150dp   ( 375px)
            identity-fixed-form      y≈150dp  → y≈263dp   ( 658px) ← input-name
            nationality-section      y≈263dp  → y≈613dp   (1533px) ← country-ARG ≈ 912px
            jersey-preview-wrapper   y≈613dp  → y≈913dp   (bajo el fold, scroll)
            identity-fixed-field-map y≈1001dp → y≈1353dp
            scrollContent.paddingBottom:240 sigue despejando el footer.

          input-name queda ENTERO sobre el fold (658px << 1530px) y country-ARG
          sigue tappable sin scrollUntilVisible, preservando el AC4 de MGC-1474.
          jersey-preview baja bajo el fold: es decorativo (no bloquea el CTA) y
          su placeholder "TU NOMBRE" era justamente la fuente de la confusión.

          MGC-1432 (histórico, sigue vigente) — identity-fixed-form vive DENTRO
          del outer ScrollView, no como View fijo hermano. En intentos previos
          (5dbdd95 attempt-4, d592a2c attempt-5 spec) vivía entre ScrollView y
          identity-sticky-footer, consumiendo ~280px del kavContent y dejando
          ScrollView con 1552px en vez de 1832px. NO volver a extraerlo.
          pointerEvents='box-none' mantiene el spec MGC-1348 para que el wrapper
          no intercepte clicks de los country-* Pressables (que ahora viven MÁS
          ABAJO en el scroll, no más arriba). */}
      {/* MGC-1737 — nationality-section REPOSICIONADA como SEGUNDO hijo del
          outer ScrollView (entre identity-header e identity-fixed-form).
          Causa raíz AC3 FAIL walk WF1 PR #427 (MGC-1732 sobre APK
          build-PR-427-20d2556): nationality-section arrancaba en y=1338px
          content, tapada completamente por sticky field-map overlay
          [0,1310][1080,1530] + sticky-footer [0,1530][1080,2130] en
          fresh-mount (scroll position = 0). Reordenando nationality ANTES
          de identity-fixed-form, country-ARG queda a y≈625px viewport,
          ENCIMA del field-map overlay 1310px (margin 685px) → tappable sin
          scrollUntilVisible.

          Layout resultante en ZY22G728HN 1080×2400 density 400 (1dp = 2.5px),
          viewport del scroll 732.8dp, footer top = 1530px, field-map top ≈
          1310px:
            identity-header          y=0      → y=375px
            nationality-section      y=375px  → y=1168px  ← country-ARG ≈ 625px ✓
            identity-fixed-form      y=1168px → y=2132px  ← input-name ≈ 1295px
            jersey-preview-wrapper   y=2132px → y=2332px

          country-ARG queda 685px encima del field-map overlay → AC3 cumplido.
          input-name a y≈1295px también ENCIMA del field-map 1310px → usuario
          puede tipear nombre sin scroll. identity-fixed-form requiere scroll
          para acceder a lastname/age/foot, trade-off aceptado para preservar
          el AC3 de MGC-1737. scrollContent.paddingBottom:512 sigue despejando
          el field-map + footer para que el form completo sea alcanzable tras
          scroll.

          Mantiene: cap NATIONALITY_FRESH_LIMIT=5 (MGC-1448), search hint,
          testID alias AR→ARG (MGC-1348 v2), lista plana sin ScrollView anidado
          (MGC-1428 intento-7). NO reintroducir ScrollView anidado.
          NO extraer nationality a sibling externo (MGC-807/843/1428 cerraron
          esa ruta por measure pass + clipping). Reordenar dentro del scroll
          es la mínima superficie de cambio. */}
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
        <Field label={t('identity.fieldNationality')}>
          <TextInput
            value={nationalityQuery}
            onChangeText={setNationalityQuery}
            placeholder={t('identity.nationalityPlaceholder')}
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
            accessibilityLabel={t('identity.nationalitySearchA11y')}
            testID="input-nationality-search"
          />
          {/* MGC-1428 — lista plana de países (sin ScrollView anidado). Países
              son hijos directos del outer ScrollView para evitar el clipping
              de RN-Android sobre bounds anidados. flexWrap mantiene orden
              vertical, maxHeight acotado por el outer ScrollView + paddingBottom:512. */}
          <View
            style={{
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              overflow: 'hidden',
            }}
          >
            {filteredNationalities.map((n) => {
              const active = profile.nationalityCode === n.code;
              // MGC-1511 — elegir un país cierra la tarea: además de limpiar el
              // search colapsamos el listado expandido de MGC-1503. Sin esto las
              // 33 filas siguen inline tras la selección y field-map vuelve a
              // caer ≈6000px bajo el fold (los FAIL de QA MGC-1450/1452 que
              // motivaron el cap de MGC-1448). El usuario puede re-expandir
              // con "Ver todas las N" cuando quiera.
              const selectNationality = () => {
                setNationality(n.code);
                setNationalityQuery('');
                setNationalityExpanded(false);
              };
              return (
                <Pressable
                  key={n.code}
                  onPress={selectNationality}
                  {...onKeyActivate(selectNationality)}
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
                  // MGC-1348 v2 — FIFA code de Argentina = 'AR' pero
                  // specs Playwright usan ISO 3166-1 alpha-3 'ARG' en
                  // `getByTestId('country-ARG')`. Alias solo para AR;
                  // resto del mundo mantiene FIFA code como testID.
                  testID={`country-${n.code === 'AR' ? 'ARG' : n.code}`}
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
                {t('identity.nationalityNoMatches')}
              </Text>
            ) : null}
          </View>
          {/* MGC-1503 — Pressable "Ver todas (N)" / "Ver menos" reemplaza al hint
              pasivo de MGC-1448. Hallazgo UX-005 P0 (audit MGC-1500): el cap a
              5 sin acción explícita se leía como lista incompleta. Ahora el
              usuario expande/colapsa sin tipear en el search. El botón vive
              debajo del listado (no como Floating Action) para respetar el
              outline del tree del outer scroll y mantener el presupuesto vertical
              del sticky-footer intacto (scrollContent.paddingBottom:512). */}
          {!nationalityQuery.trim() ? (
            <View
              testID="nationality-toggle-row"
              collapsable={false}
              style={{
                marginTop: spacing[3],
                gap: spacing[1],
              }}
            >
              <Pressable
                testID={
                  nationalityExpanded
                    ? 'btn-nationality-collapse'
                    : 'btn-nationality-expand'
                }
                onPress={() => setNationalityExpanded((v) => !v)}
                {...onKeyActivate(() => setNationalityExpanded((v) => !v))}
                accessibilityRole="button"
                accessibilityState={{ expanded: nationalityExpanded }}
                accessibilityLabel={
                  nationalityExpanded
                    ? t('identity.nationalityCollapseA11y')
                    : t('identity.nationalityExpandA11y', { n: NATIONALITIES.length })
                }
                collapsable={false}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing[2],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: nationalityExpanded
                    ? colors.borderStrong
                    : colors.primary,
                  backgroundColor: nationalityExpanded
                    ? colors.surface
                    : colors.primarySoft,
                  minHeight: 44,
                }}
              >
                <Text
                  style={{
                    color: nationalityExpanded ? colors.text : colors.primary,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {nationalityExpanded
                    ? t('identity.nationalityCollapseLabel')
                    : t('identity.nationalityExpandLabel', { n: NATIONALITIES.length })}
                </Text>
                <Text
                  style={{
                    color: nationalityExpanded ? colors.text : colors.primary,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {nationalityExpanded ? '▲' : '▼'}
                </Text>
              </Pressable>
              <Text
                testID="nationality-search-hint"
                style={{
                  color: colors.textMuted,
                  fontSize: fontSize.sm,
                  textAlign: 'center',
                }}
              >
                {t('identity.nationalityHint', { n: NATIONALITIES.length })}
              </Text>
            </View>
          ) : null}
        </Field>
      </View>
      {/* MGC-1532 (actualizado por MGC-1737) — identity-fixed-form reubicado
          como TERCER hijo del outer ScrollView (después de nationality-section,
          antes de jersey-preview-wrapper). Causa raíz original MGC-1532:
          `isIdentityComplete` exige SOLO `name.trim().length >= 2`, así que
          el nombre es el ÚNICO gate de Continuar. MGC-1737 invierte la
          prioridad: nationality-section debe quedar ARRIBA del form para
          que country-ARG sea visible sin scrollUntilVisible (AC3 explícito).
          input-name sigue siendo tappable en y≈1295px (arriba del field-map
          overlay 1310px) y los campos restantes (lastname/age/foot) requieren
          scroll — trade-off explícito en MGC-1737 para preservar el AC3 de
          WF1 PR #427 walk MGC-1732.

          pointerEvents='box-none' mantiene el spec MGC-1348 para que el wrapper
          no intercepte clicks de los country-* Pressables que viven MÁS
          ARRIBA en el scroll. */}
      <View
        testID="identity-fixed-form"
        collapsable={false}
        // MGC-1348 v2 — Playwright web flake: box-none evita que el wrapper
        // capture clicks de los country-* Pressables que viven más arriba en
        // el scroll (RNW hit-test pasaba por el wrapper vacío). En Android
        // box-none es no-op cuando el wrapper tiene content visible.
        pointerEvents="box-none"
        style={{
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          // MGC-1339 — overshoot fix: padding spacing[1]=4 → spacing[0]=0
          // (-8dp). Compactación preservada al mover dentro del scroll.
          // MGC-1347 — restaurar paddingHorizontal spacing[1]=4dp para que
          // TextInput Nombre y Pressables Pie hábil no peguen contra el
          // borde lateral. paddingVertical=0 explícito para preservar el
          // budget vertical de 113dp del AC MGC-1341.
          paddingHorizontal: spacing[1],
          paddingVertical: 0,
          gap: spacing[1],
          flexShrink: 0,
        }}
      >
        {/* MGC-1330: compactación para liberar 86dp de budget vertical.
            viewport 732.8dp = identity-fixed-form (113dp target) +
            identity-fixed-field-map 320dp (ancla MGC-1324) +
            identity-sticky-footer 240dp (ancla MGC-1286) + 59.6dp slack.
            Cambios: padding form 16→4, gap form 16→4, Field label gap 8→0,
            inputs minHeight 48→40, TextInput/Pressable paddingV 12→8,
            label fontSize 14→12. Total estimado ~105dp. Patrón preserva:
            field wrapper collapsable=false, label accessibilityRole=text,
            input hit-box via minHeight:40 + paddingV:8 + border. Refs:
            [[mgc1330-form-budget]], MGC-632, MGC-686, MGC-1286, MGC-1324. */}
        <Field
          label={t('identity.fieldName')}
          labelStyle={{ fontSize: fontSize.xs, lineHeight: 14 }}
          wrapperStyle={{ gap: 0 }}
        >
          <View
            testID="input-name-wrapper"
            collapsable={false}
            // MGC-1348 v2 — box-none belt: el wrapper no necesita capturar
            // clicks, el TextInput hijo sí. Patrón recursivo Field wrapper.
            pointerEvents="box-none"
            style={{ minHeight: 40, width: '100%' }}
          >
            <TextInput
              value={profile.name}
              onChangeText={setName}
              placeholder={t('identity.namePlaceholder')}
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
                  paddingVertical: spacing[2],
                  fontSize: fontSize.base,
                },
              ]}
              accessibilityLabel={t('identity.nameA11y')}
              testID="input-name"
            />
          </View>
        </Field>

        {/* MGC-1628 / WF1 — Apellido en input separado (wireframe §WF1).
            Mismo patrón que Nombre: wrapper collapsable=false + box-none,
            TextInput con autoCapitalize=words + maxLength 24 (rango
            validado por isIdentityComplete: ≥2 chars). El setter
            `setLastName` escribe a `profile.lastName` (campo nuevo,
            ver identity-state.ts). testID `input-lastname` se publica
            para que QA (MGC-1626 walk E2E) lo pueda apuntar. */}
        <Field
          label={t('identity.fieldLastName')}
          labelStyle={{ fontSize: fontSize.xs, lineHeight: 14 }}
          wrapperStyle={{ gap: 0 }}
        >
          <View
            testID="input-lastname-wrapper"
            collapsable={false}
            pointerEvents="box-none"
            style={{ minHeight: 40, width: '100%' }}
          >
            <TextInput
              value={profile.lastName ?? ''}
              onChangeText={setLastName}
              placeholder={t('identity.lastNamePlaceholder')}
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
                  paddingVertical: spacing[2],
                  fontSize: fontSize.base,
                },
              ]}
              accessibilityLabel={t('identity.lastNameA11y')}
              testID="input-lastname"
            />
          </View>
        </Field>

        {/* MGC-1628 / WF1 — Edad 16-35. TextInput numérico, validación
            inline en `setAge` (clamp 16-35). El hint debajo del input
            (`t('identity.ageHelp')`) explica al usuario el rango y por qué
            (la edad se incrementa temporada a temporada y la retirada
            ocurre a los 35). testID `input-age` para QA walk. */}
        <Field
          label={t('identity.fieldAge')}
          labelStyle={{ fontSize: fontSize.xs, lineHeight: 14 }}
          wrapperStyle={{ gap: 0 }}
        >
          <View
            testID="input-age-wrapper"
            collapsable={false}
            pointerEvents="box-none"
            style={{ minHeight: 40, width: '100%' }}
          >
            {/* MGC-1760 — Pressable wrapper con hitSlop=12 cada lado para que el
                tap perimetral (12dp = +24dp total por eje) abra el teclado. En
                Android nativo, hitSlop en TextInput no extiende el hitbox de
                focus (MGC-1760 QA walk PR #427 f08d22e). El Pressable hijo
                captura el tap perimetral y llama ageInputRef.current?.focus() */}
            <Pressable
              onPress={() => ageInputRef.current?.focus()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              collapsable={false}
              testID="input-age-tap-target"
              accessible={false}
            >
              <TextInput
                ref={ageInputRef}
                value={String(profile.age)}
                onChangeText={(txt) => {
                  // Acepta sólo dígitos. El clamp final lo hace setAge.
                  const cleaned = txt.replace(/[^0-9]/g, '').slice(0, 2);
                  const parsed = cleaned === '' ? 16 : Number.parseInt(cleaned, 10);
                  setAge(parsed);
                }}
                placeholder={t('identity.agePlaceholder')}
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={2}
                collapsable={false}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.borderStrong,
                    borderRadius: radii.md,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    fontSize: fontSize.base,
                  },
                ]}
                accessibilityLabel={t('identity.ageA11y')}
                testID="input-age"
              />
            </Pressable>
            <Text
              testID="input-age-help"
              style={{
                color: colors.textMuted,
                fontSize: fontSize.xs,
                marginTop: spacing[1],
                lineHeight: 14,
                includeFontPadding: false,
              }}
            >
              {t('identity.ageHelp')}
            </Text>
          </View>
        </Field>

        {/* Preferred foot — MGC-632: wrapper View collapsable=false +
            minHeight:48. Pressable hijos sin collapsable={false} porque
            RN-Android mide bounds reales desde el wrapper padre cuando
            vive fuera del ScrollView (verificado por QA MGC-744 sobre
            stepper). Si QA reporta flake en los Pressables individuales
            (Izquierdo/Derecho/Ambos), replicar el patrón canónico del
            stepper (collapsable={false} en cada Pressable hijo). */}
        <Field
          label={t('identity.fieldFoot')}
          labelStyle={{ fontSize: fontSize.xs, lineHeight: 14 }}
          wrapperStyle={{ gap: 0 }}
        >
          <View
            testID="btn-foot-row"
            collapsable={false}
            // MGC-1348 v2 — box-none belt: el wrapper no necesita capturar
            // clicks, los 3 Pressables hijos sí. Patrón recursivo Field wrapper.
            pointerEvents="box-none"
            style={{
              flexDirection: 'row',
              gap: spacing[2],
              width: '100%',
              minHeight: 40,
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
                    paddingVertical: spacing[2],
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
                    {f === 'left' ? t('identity.footLeft') : f === 'right' ? t('identity.footRight') : t('identity.footBoth')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      </View>
      {/* Jersey preview — sección fija sibling del kavContent (sin ScrollView).
          height:300 + maxHeight:300 + overflow:hidden fuerzan el clamp al
          intrinsic height del JerseyPreview md (160x200) + título + label
          + padding + gaps (≈ 276px), evitando que RN-Android lo expanda al
          tamaño del viewport y empuje secciones inferiores fuera del dump.
          Patrón MGC-1005.
          MGC-1435 — bump 240→300 sobre PR-348. En PR-347 QA reportó
          jersey-preview bounds=[340,873][740,1249] h=376px overfloweando el
          wrapper 240px con overflow:hidden → SVG del país clippeado en la
          mitad inferior. 300px acomoda 200 (jersey) + 20 (title) + 16 (label)
          + 24 (padding) + 16 (gaps) = 276px con 24px slack. Mantener
          overflow:hidden como belt para que RN-Android no expanda el
          wrapper al viewport completo. */}
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
          height: 300,
          maxHeight: 300,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
          {t('identity.jerseyEyebrow')}
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
            countryCode={profile.nationalityCode ?? 'AR'}
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
          {t('identity.jerseyCaption', { position: profile.position })}
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
      {/* MGC-1585 / PR #395: la selección de liga se removió de /identity.
          Ocurre exclusivamente en /academy paso 3 (cada club expone su liga).
          Ver MGC-1567 walk E2E: identity → dashboard → academy → Morón →
          /temporada resulta jugable sin seleccionar liga en identity.
          El árbol del scroll queda:
            identity-header → identity-fixed-form → nationality-section
            → jersey-preview-wrapper
          y los bounds reportados en ZY22G728HN density 400 son ahora
          siempre positivos en fresh-mount (no más secciones clipeadas bajo
          el fold del ScrollView position:absolute full-bounds). */}
      </ScrollView>
      {/* MGC-1533 — field-map-section EXTRAÍDA como fixed sibling absoluto.
          Antes vivía como SIBLING dentro del ScrollView (MGC-1428 intento-7
          opción B), pero el sticky-footer absolute bottom:0 height:240 opaco
          (MGC-1448) overlapeaba la mitad inferior del wrapper cuando el
          usuario scrolleaba para revelar el field map: positions LM (y=0.42)
          / CAM (y=0.40) / RM / CM / CDM / LB / RB / CB / GK caían con sus
          bounds detrás del footer top y=1530px en ZY22G728HN density 400 →
          Pressables pos-XX no interceptaban el tap (RN-Android hit-testea
          top-most view, sube por el árbol y nunca baja al Pressable oculto).
          Como fixed sibling kavContent-level con position:absolute bottom:240
          el field map queda anclado ARRIBA del sticky-footer sin solaparse
          con btn-identity-continue (z-index natural del árbol de pintado: el
          ScrollView va antes que el field map, el field map antes que el
          sticky-footer). Todas las Pressables pos-XX quedan siempre tappable
          independientemente del scroll position. HitSlop +8dp WCAG 2.5.5
          (MGC-1502) preservado. zIndex:10 explícito por si RN-Android
          empata con siblings sin position:absolute declarada en la rama
          del ScrollView. flexShrink:0 garantiza que el sticky-footer (240dp
          absolute) no consume flex space que achique el section a 0 en
          flex-shrink pass. */}
      {/* MGC-1578 — `pointerEvents="box-none"` INCONDICIONAL sobre
          identity-fixed-field-map. Mismo patrón que sticky-footer abajo.
          El field-map solo dibuja fondo + field-map-wrapper; los Pressables
          pos-* siguen auto y capturan sus taps. Liberar el área vacía
          permite que un swipe iniciado en el centro del viewport (540,1400)
          llegue al ScrollView y haga scroll, en lugar de ser consumido por
          el field-map absoluto. */}
      <View
        testID="identity-fixed-field-map"
        collapsable={false}
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 240, // encima del identity-sticky-footer height:240
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3],
          paddingBottom: spacing[3],
          gap: spacing[2],
          backgroundColor: colors.bg,
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <Field
          label={t('identity.fieldPosition')}
          labelStyle={{ fontSize: fontSize.xs, lineHeight: 14 }}
          wrapperStyle={{ gap: 0 }}
        >
          {/* MGC-1628 / WF1 — chips de posición (wireframe §WF1):
              GK DEF MID FWD en una sola fila horizontal. El chip
              seleccionado persiste `profile.position` a un representante
              del grupo (GK → 'GK', DEF → 'CB', MID → 'CAM', FWD → 'ST').
              F2 reemplaza esta fila por el árbol de decisión posicional
              completo (MGC-1628 §L4 / MGC-1675). testIDs preservan el
              contrato E2E existente (pos-GK / pos-CB / pos-CAM / pos-ST
              en e2e/simulador-carrera.spec.ts + axe mgc-462-contrast). */}
          <View
            testID="position-chips-row"
            collapsable={false}
            pointerEvents="box-none"
            style={{
              flexDirection: 'row',
              gap: spacing[2],
              width: '100%',
              minHeight: 48,
            }}
          >
            {POSITION_CHIPS.map((chip) => {
              const active = chip.ids.includes(profile.position);
              return (
                <Pressable
                  key={chip.id}
                  onPress={() => setPosition(chip.defaultPos)}
                  {...onKeyActivate(() => setPosition(chip.defaultPos))}
                  accessibilityRole="button"
                  accessibilityLabel={t('identity.positionChipsA11y', {
                    label: chip.label,
                  })}
                  accessibilityState={{ selected: active }}
                  // MGC-1502 — WCAG 2.5.5: touch target ≥44dp. Chip visual
                  // 48dp + hitSlop +8 cada lado → 64dp hitbox. testID
                  // `pos-${chip.id}` preserva el contrato `pos-GK/CB/CAM/ST`
                  // que las specs E2E y axe ya consumen.
                  hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
                  testID={`pos-${chip.id}`}
                  collapsable={false}
                  style={{
                    flex: 1,
                    paddingVertical: spacing[3],
                    borderRadius: radii.md,
                    borderWidth: 2,
                    borderColor: active ? GROUP_COLOR[chip.group] : colors.borderStrong,
                    backgroundColor: active
                      ? GROUP_COLOR[chip.group]
                      : colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: active ? '#0A120E' : colors.text,
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.bold,
                      letterSpacing: 1,
                    }}
                  >
                    {t(`identity.positionGroup${chip.label}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      </View>
      {/* MGC-1314: cierre del ScrollView externo tras wrappers extraídos.
          identity-fixed-form e identity-fixed-field-map NO son hijos del
          ScrollView — viven como siblings (líneas 786+) entre el ScrollView y
          identity-sticky-footer. Causa raíz MGC-1309 / MGC-1035: en fresh-mount
          ZY22G728HN 1080×2400 density 400, RN-Android clipea los bounds de
          los hijos del ScrollView al viewport visible (≈445dp). Wrappers que
          se medían naturalmente por debajo del fold del ScrollView
          (identity-fixed-form input-name a y≈2151, identity-fixed-field-map
          a y≈1697, field-map-wrapper a y≈1805) reportaban bounds con
          top=natural_y > bottom=viewport_bottom=1530 → bounds invertidos
          h=-248dp / -67dp / -110dp. Tap input-name → focused=NONE porque el
          hit-box resuelto por uiautomator estaba en coordenadas inválidas.

          Cherry-pick f832115 (MGC-1309 / MGC-1283 883ac79) añadió flexBasis:240
          + flexGrow:0 + flexShrink:0 sobre identity-sticky-footer para
          reservar 240dp al fondo, pero solo restauró ScrollView h=445dp (no
          h=92dp colapsado como antes). NO resolvió los bounds invertidos
          porque la causa raíz NO era sticky-footer sino la pertenencia de
          los wrappers al subtree del ScrollView.

          Patrón canónico: MGC-751/PR-254 (extraer input-name-wrapper +
          btn-foot-row) + MGC-811/PR-261 (extraer field-map-wrapper) +
          MGC-1305/PR-325 (extraer identity-fixed-field-map). El extracto a
          View fijo hermano del ScrollView saca los wrappers del measure
          pass del contentContainer y Yoga reporta bounds reales positivos
          en uiautomator fresh-mount, sin depender del scroll position.

          ScrollView conserva flexGrow:1 + flexShrink:1 (MGC-1286/PR-320) y
          removeClippedSubviews={false} (MGC-1286 belt) sobre las secciones
          scrollables: identity-header + jersey-preview-wrapper +
          nationality-section. ScrollView cubre TODO el alto disponible
          menos identity-fixed-form (auto) + identity-fixed-field-map (auto)
          + identity-sticky-footer (240).

          field-map-wrapper mantiene height:320 + flexBasis:320 + flexShrink:0
          (MGC-1143 spec / MGC-1299 restore / MGC-1309 belt) sin la
          regresión 380dp que MGC-1294 reportó sobre PR-320.

          MGC-1428 — field-map-section RE-INGRESADO al outer ScrollView como
          hijo directo (sibling visible dentro del scroll, opción B fiel).
          El bloque que existía aquí como View fijo hermano fue removido y
          movido dentro del ScrollView, donde el measure pass del
          contentContainer lo reporta bounds positivos en el hierarchy dump
          fresh-mount y no queda AUSENTE. */}
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
      {/* MGC-1428 — identity-sticky-footer pasa a position:absolute bottom:0
          (overlap) en lugar de flex sibling con height:240. Spec MGC-1411
          opción B: el footer overlapea el bottom del kavContent y NO consume
          espacio flex del ScrollView. translateY IME avoidance se mantiene
          sobre el wrapper absolute (Android only).
          Razón del cambio: el patrón anterior (height/flexBasis:240 + flex
          sibling) competía con el outer ScrollView por la altura del
          kavContent; combinado con scroll {flexShrink:1} provocaba Yoga
          collapse (ver MGC-1416 FAIL diag). Con position:absolute, el footer
          queda fuera del flex layout y el ScrollView toma TODO el alto
          disponible. scrollContent.paddingBottom:240 reserva el area del
          overlap para que el último hijo (country-CO) sea accesible tras
          scroll completo. */}
      {/* MGC-1448 — banda del footer determinista y opaca.
          Causa raíz AC5 FAIL (QA MGC-1445 sobre PR-350 / 8a4da64): el footer
          absolute overlapea los últimos 240dp del viewport, pero SIN height
          explícito su alto medido dependía del contenido (QA MGC-1441 midió
          209.2dp; MGC-1445 midió 600px=240dp) y el wrapper capturaba el touch
          en TODA su caja. country-ARG quedaba dibujado debajo del footer
          (bounds [43,1673][1038,1813] vs footer top y=1530) y el tap de QA en
          (540,1743) lo comía el footer: RN-Android hit-testea el view más
          alto en z-order y sube por el árbol (nunca baja al Pressable de
          abajo) → Argentina no se seleccionaba, el input quedaba con el
          composing text del IME y Continuar seguía deshabilitado.
          Fix: height:240 explícito (= scrollContent.paddingBottom:240, la
          banda reservada) + justifyContent:'flex-end' + backgroundColor
          opaco. Contrato resultante, verificable por QA:
            footerTop = 2130 - 600 = 1530px en ZY22G728HN density 400.
            Todo lo dibujado con y >= footerTop está TAPADO y no es tappable;
            todo lo visible es tappable (banda opaca, sin huecos
            transparentes que muestren contenido intocable).
          Por eso los country-* se tapean SIEMPRE tras scrollUntilVisible
          dejándolos con bottom < footerTop, nunca sobre bounds crudos del
          dump fresh-mount. NO usar pointerEvents='box-none' acá: haría
          tappable contenido tapado por la banda opaca (peor que el bug). */}
      {/* MGC-1578 — `pointerEvents="box-none"` INCONDICIONAL sobre
          identity-sticky-footer. Versiones tempranas condicionaban el
          pointerEvents a un toggle de dropdown que rompía el tap inicial
          (chicken-and-egg: el footer overlapeaba el toggle y se comía el
          primer tap que debía dispararlo). El footer solo pinta fondo +
          bandas opacas; los Pressables hijos (btn-number, btn-identity-
          continue) siguen siendo auto, capturan sus propios taps y el área
          vacía deja pasar el touch hacia el ScrollView debajo.
          Mismo razonamiento que MGC-1348 v2 sobre identity-fixed-form:
          contenedor que solo estiliza → box-none, Pressables auto. */}
      <View
        testID="identity-sticky-footer"
        collapsable={false}
        pointerEvents="box-none"
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 240,
            justifyContent: 'flex-end',
            backgroundColor: colors.bg,
          },
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
      {/* MGC-1567 — `pointerEvents='box-none'` INCONDICIONAL. Sticky
          contenedor de stepper (120dp). El bg es la única razón visual;
          los Pressables hijos (btn-number-{minus,plus}) mantienen `auto`
          y capturan sus taps. Sin box-none el bg overlapea los
          league-list-items cuando leagueOpen=true y bloquea el tap de
          selección. */}
      <View
        testID="btn-number-sticky"
        collapsable={false}
        pointerEvents="box-none"
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
          {t('identity.numberLabel')}
        </Text>
        {/* MGC-1567 — `pointerEvents='box-none'` INCONDICIONAL. Fila flex de
            los botones −N +N. Mismo razonamiento que btn-number-sticky:
            row bg-only libera el área para que un tap sobre los
            league-list-items llegue al Pressable hijo. */}
        <View
          testID="btn-number-row"
          collapsable={false}
          pointerEvents="box-none"
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
            accessibilityLabel={t('identity.numberDecrement')}
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
            accessibilityLabel={t('identity.numberIncrement')}
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
          MGC-1567 — `pointerEvents='box-none'` INCONDICIONAL. El bg del
          footer (240dp, colors.bg) ocupa exactamente el área donde caen los
          league-list-items cuando el wrapper se expande a 340dp; sin
          box-none el bg captura el tap y bloquea la selección. El Pressable
          btn-identity-continue (hijo directo, default auto) captura su
          propio tap. Patrón MGC-1348 v2 / MGC-1578 (PR-394) extendido. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.footer,
          {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            padding: spacing[4],
          },
        ]}
      >
        {/* MGC-1532 — hint del CTA deshabilitado. Segunda mitad del AC del
            bug: aunque el reorder ya deja input-name sobre el fold, el botón
            gris sin explicación seguía siendo un dead-end si el usuario no
            tipea. `isIdentityComplete` sólo mira name.length>=2, así que el
            texto nombra el campo exacto que falta. Presupuesto vertical del
            sticky-footer (height:240 fijo, MGC-1448): stepperSticky 120 +
            footer (16+52+16) 84 = 204dp; el hint suma 14 (lineHeight) + 4
            (marginBottom) = 18dp → 222dp, con 18dp de slack contra la banda
            opaca. NO agrandar la tipografía acá sin re-medir: si el contenido
            supera 240dp, justifyContent:'flex-end' lo desborda POR ARRIBA de
            la banda opaca y queda dibujado sobre el scroll sin fondo. */}
        {!canContinue ? (
          <Text
            testID="identity-continue-hint"
            style={{
              color: colors.textMuted,
              fontSize: fontSize.xs,
              lineHeight: 14,
              includeFontPadding: false,
              marginBottom: spacing[1],
              textAlign: 'center',
            }}
          >
            {t('identity.continueHint')}
          </Text>
        ) : null}
        <Button
          label={t('identity.continue')}
          onPress={onContinue}
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canContinue}
          testID="btn-identity-continue"
          accessible
          importantForAccessibility="yes"
          accessibilityHint={t('identity.continueA11yHint')}
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
    // MGC-1348 v2 — pointerEvents='box-none' en el View wrapper de Field.
    // El wrapper en sí no necesita capturar clicks (su label es solo texto);
    // sus children (TextInput / Pressable / ScrollView con Pressables) sí
    // reciben eventos normalmente porque box-none solo afecta al bounding
    // box del View actual, NO a sus hijos. Necesario para que el label
    // <Text> interno (que en RNW es un <div>) no intercepte clicks del
    // dropdown Nacionalidad cuando el wrapper padre identity-fixed-form
    // lo contiene — patrón QA MGC-1350 / PR-332 v2.
    <View pointerEvents="box-none" style={[{ gap: spacing[2] }, wrapperStyle]}>
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
  // MGC-1314 belt MGC-927: explicitar flexDirection: 'column' para que el
  // view manager nativo del kavContent herede column del padre
  // KeyboardAvoidingView y NO colapse el ScrollView a h=0 mid measure pass
  // cuando el sticky-footer toma altura por translateY (IME avoidance).
  kavContent: { flex: 1, flexDirection: 'column', position: 'relative' },
  // MGC-1274: outer ScrollView flexGrow:1 vive dentro del kavContent. Toma
  // todo el alto disponible dejando identity-sticky-footer (flexBasis:240
  // flexShrink:0) como único sibling siempre visible.
  scroll: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // MGC-1428 — paddingBottom:240 para reservar el alto del sticky-footer al
  // fondo del ScrollView. Sin esto, los últimos países (country-CO) caen
  // debajo del viewport natural y RN-Android clipea sus bounds contra el
  // sticky-footer top y=1530 → bottom < top (invertido). Spec MGC-1411
  // opción B: outer ScrollView + sticky-footer sibling + paddingBottom:240.
  // MGC-1435 — fix sobre PR-348 (intento-5 FAIL QA). RESTAURAR flexGrow:1
  // en scrollContent (estaba en PR-346 PASS 7e4280f y PR-348 lo quitó
  // intentando evitar un collapse distinto). Causa raíz: sin flexGrow:1,
  // RN-Android mide el ScrollView contra el contentContainer (wrap_content
  // ≈ 831px) en lugar del flex:1 del kavContent (732.8dp). country-CO
  // (último país) cae fuera del viewport y queda con bottom clippeado al
  // scroll bottom → bounds invertidos (QA MGC-1435 sobre SHA 17d592a).
  // Con flexGrow:1 + paddingBottom, contentContainer ocupa TODO el
  // viewport del ScrollView (1832px = 732.8dp), permitiendo scroll completo
  // hasta country-CO sin invertir bounds. Patrón canónico PR-346 PASS.
  // MGC-1533 — paddingBottom bumped 240→512. Antes el field-map-section
  // vivía como último hijo del ScrollView (MGC-1428), así que paddingBottom:240
  // solo tenía que despejar el sticky-footer (240dp). Ahora vive como fixed
  // sibling kavContent-level con position:absolute bottom:240 height:352
  // (wrapper 320 + padding 32), superpuesto encima del ScrollView. Para que
  // el form (identity-fixed-form, ahora 2º hijo tras PR-385/MGC-1532) scrollee
  // por encima del overlay del field map (y=8-360) + footer (y=360-600),
  // el paddingBottom necesita ≥ (form_height=113) + (field_map_top=8) = 121dp
  // sobre el scroll viewport. 512dp da buffer amplio: form-bottom llega a
  // y=600-512=88dp → form-top y=-25dp (off-screen al fondo del scroll) →
  // al scrollear arriba del todo el form queda en y=0-113dp totalmente
  // visible POR ENCIMA del overlay del field map.
  scrollContent: { flexGrow: 1, paddingBottom: 512 },
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
  // MGC-821: aspectRatio 0.7 + width 100% generaba ~1497px de alto en
  // ZY22G728HN 1080x2400, empujando identity-sticky-footer debajo del
  // viewport y ocultando nationality/sticky-stepper/btn-identity-continue.
  // MGC-1299: PR-320 (MGC-1286) reintrodujo ScrollView outer y declaró
  // MGC-1628 / WF1 — el `fieldMapWrapper` (soccer field con dots) se
  // reemplazó por chips de posición horizontales (`POSITION_CHIPS`
  // módulo-scope). La fila de chips lleva styling inline en el JSX
  // (flexDirection:'row', gap, minHeight:48) — no requiere style acá.
  // El wrapper `identity-fixed-field-map` sigue existiendo como
  // fixed sibling absolute (mismo layout bottom:240) para mantener la
  // jerarquía visual del form (Nombre/Apellido/Edad/Nacionalidad arriba
  // en el scroll + chips de posición abajo + stepper + Continue).
  // MGC-1428 — fixedFieldMap style retirado: identity-fixed-field-map ya no
  // vive fuera del ScrollView. El wrapper ahora es hijo directo del outer
  // scroll y su padding/gap se aplican inline en el JSX (ver bloque arriba).
  // MGC-831: colores del wrapper se aplican inline (StyleSheet.create
  // corre a module-scope, fuera del alcance de useTheme() — colors/radii
  // solo viven dentro del componente).
});
