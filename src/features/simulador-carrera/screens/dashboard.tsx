import React, { Suspense, lazy } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { copy, copyHelpers } from '@/design/copy/es-AR/simulador-carrera';
import { useCareerStore, flushPendingSave } from '@/shared/store/careerStore';
import { NATIONALITIES_BY_CODE } from '@/features/career/nationalities';
import { ResetCareerButton } from '@/features/simulador-carrera/components/ResetCareerButton';

// Lazy-load del bloque "Estrategia recomendada" (MGC-482).
// Separa `recommendStrategy` + `strategy` (~10 KB) del chunk inicial
// de /dashboard. Se renderiza sólo si el motor devuelve una estrategia
// aplicable al perfil actual.
const RecommendedStrategy = lazy(() =>
  import('@/features/career/components/RecommendedStrategy').then((m) => ({
    default: m.RecommendedStrategy,
  })),
);

// Lazy-load del JerseyPreview (MGC-532): separa el SVG patterns (~10 KB)
// del chunk inicial de /dashboard. El testid canónico `jersey-preview`
// (MGC-466) lo esperan los specs e2e como hero del jugador post-navigate
// desde el home. Render placeholder mientras el chunk resuelve.
const JerseyPreview = lazy(() =>
  import('@/design/components/JerseyPreview').then((m) => ({ default: m.JerseyPreview })),
);

// MGC-1577 / MGC-1608 — fallback módulo-scope para `s.log ?? ...`. La
// referencia es estable entre renders (Zustand v5 usa `Object.is`); un
// objeto literal inline crearía referencia NUEVA cada render → loop
// "Maximum update depth exceeded" en Dashboard. `as const` endurece el
// tipo (readonly timeline/events) para que un caller no pueda mutar
// el placeholder por accidente y disparar renders extra.
const EMPTY_LOG = { timeline: [], events: [] } as const;

export default function DashboardScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const profile = useCareerStore((s) => s.profile);
  const stage = useCareerStore((s) => s.stage);
  // MGC-1577 / MGC-1608 — split selector en dos llamadas. La primera
  // devuelve el snapshot real (o undefined); la segunda aplica el
  // fallback módulo-scope. Evita el crash que QA reprodujo en MGC-1576
  // sobre build-PR-392 vc=56 al volver a Dashboard tras fichar club
  // (2da visita): el selector inline `s.log ?? { ... }` creaba
  // referencia nueva cada render → Maximum update depth exceeded.
  const storedLog = useCareerStore((s) => s.log);
  const log = storedLog ?? EMPTY_LOG;
  const openAcademy = useCareerStore((s) => s.openAcademy);
  const startDraft = useCareerStore((s) => s.startDraft);
  // MGC-1650 (WF4) — `startMatch` calcula el MatchOutcome y lo
  // deposita en `matchStore` (transient).
  const startMatch = useCareerStore((s) => s.startMatch);

  // MGC-1769 — nationalityCode puede ser `null` en /identity. En
  // /dashboard la carrera ya pasó `commitIdentity` (gate exige no-null),
  // pero TypeScript no lo infiere. `?? 'AR'` es fallback cosmético.
  const nat = NATIONALITIES_BY_CODE[profile.nationalityCode ?? 'AR'];

  // MGC-1504 — Render condicional del timeline. Antes el dashboard
  // pintaba 23 filas hardcoded (age 16..38, OVR/APPS/GOALS/AST en 0) para
  // simular una carrera que aún no empezó. Eso engañaba al usuario: la tabla
  // sugería "ya jugaste 23 temporadas y no marcaste ni un gol". Ahora, si la
  // carrera está fresca (log.timeline vacío) mostramos una card motivadora
  // con CTA al draft en lugar de la tabla mentirosa.
  const timelineHasContent = log.timeline.length > 0;

  // Lazy-load del bloque "Estrategia recomendada" (MGC-482):
  // el cálculo `recommendStrategy(profile)` + `strategyCopy` corre dentro
  // del chunk diferido; el inicial sólo importa la firma del componente.
  // Ver <RecommendedStrategy> abajo.

  const onAcademyPress = async () => {
    // MGC-1531 — Branch sobre profile.club. Antes el CTA
    // "Jugar la próxima fecha" llamaba openAcademy() incondicional y
    // navegaba a /academy; tras fichar por un club, el tap re-abría
    // el academy "Elegí tu primer club" (Paso 3 de 3) y la carrera
    // quedaba atrapada en un loop sin poder avanzar al partido.
    //
    // Reglas:
    //   · Sin club → abrir academy para que el jugador fiche (path
    //     legacy pre-club; mismo flushPendingSave de MGC-722 para
    //     sobrevivir force-stop).
    //   · Con club → MGC-1650 (WF4 partido + WF5 post-partido). El
    //     CTA "Jugar la próxima fecha" ahora dispara `startMatch()`
    //     y navega a `/simulador-carrera/match`.
    if (!profile.club) {
      openAcademy();
      await flushPendingSave();
      router.push('/simulador-carrera/academy');
      return;
    }
    await startMatch();
    router.push('/simulador-carrera/match');
  };

  // MGC-209: CTA al flow de 6 pantallas (draft → tu-jugador → club → temporada → fin-carrera).
  // Se muestra cuando el jugador todavía no pasó por el draft. Permite acceder
  // a las pantallas MGC-209 sin romper el flow legacy academy → match.
  // MGC-284: `startDraft` ahora es async + await flushPendingSave; el
  // await acá garantiza que el board + stage='draft' queden en disco
  // antes de navegar — patrón idéntico al de `commitIdentityAndStartDraft`
  // en HomepageCareerStarter (MGC-273).
  // MGC-698: tras academy onPickClub → acceptClub() el stage queda en
  // 'clubStart' (no vuelve a 'dashboard'). Incluyo clubStart en el show
  // para que el CTA "Empezar draft de leyendas" sea visible y el flow AC7
  // (identity → dashboard → academy → clubStart → draft) no quede atrapado.
  // MGC-1393: la heurística basada sólo en `stage` se rompe cuando el
  // usuario entra a academy y vuelve via `academy_back_cta` — el back no
  // revierte stage='academy', entonces el dashboard re-renderizaba con
  // showDraftCta=false y ocultaba el CTA. La nueva heurística usa estado
  // global de carrera (`profile.club`): el CTA queda visible mientras el
  // jugador no haya fichado por un club, más el caso especial `clubStart`
  // (MGC-698). Stages post-draft caen fuera porque `profile.club` ya quedó
  // seteado por `acceptClub`/`pickClub`.
  const showDraftCta = !profile.club || stage === 'clubStart';
  const onDraftPress = async () => {
    await startDraft();
    router.push('/simulador-carrera/draft');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[5], padding: spacing[4] }]}
        testID="dashboard-screen"
      >
        {/* Jersey hero (MGC-532): lazy-loaded para code-split fuera del chunk
            inicial de /dashboard. Mismo testid canónico que identity.tsx para
            que los specs e2e post-navigate home→dashboard encuentren el hero
            del jugador. Placeholder mantiene dimensiones fijas (evita CLS). */}
        <View
          style={{
            alignItems: 'center',
            paddingVertical: spacing[3],
          }}
        >
          <Suspense
            fallback={
              <View
                testID="jersey-preview-fallback"
                accessibilityElementsHidden
                style={{
                  width: 160,
                  height: 200,
                  borderRadius: 18,
                  backgroundColor: colors.surface2,
                }}
              />
            }
          >
            {/* MGC-1802 P1-1 — cuando el jugador ya fichó por un club, el
                jersey hero muestra los colores del club (azul/amarillo
                Boca, etc.) en lugar de la bandera del país. Antes el
                hero siempre renderizaba `profile.nationalityCode ?? 'AR'`
                y el walk MGC-1739 catalogó esto como P1-1: «Camiseta
                muestra bandera país (AR) en vez de colores club (Boca
                Juniors azul/amarillo)».

                Cleanup CTO: ya no mandamos sentinel `countryCode='unknown'`
                para forzar la rama neutra — JerseyPreview ahora acepta
                countryCode opcional y cae a la paleta override cuando está
                presente. Pre-fichaje (sin club) sigue mostrando el país. */}
            <JerseyPreview
              {...(profile.club
                ? {
                    paletteOverride: {
                      name: profile.club.name,
                      primary: profile.club.crestColor,
                      secondary: profile.club.crestAccent,
                      accent: profile.club.crestAccent,
                      // dorsal omitido a propósito: JerseyPreview lo
                      // deriva del primary con WCAG ≥ 4.5:1 (cleanup
                      // evita dorsal invisible cuando crestColor≈crestAccent,
                      // p.ej. Boca azul+amarillo queda OK).
                    },
                  }
                : { countryCode: profile.nationalityCode ?? 'AR' })}
              number={profile.number}
              name={profile.name}
              size="md"
              testID="jersey-preview"
            />
          </Suspense>
        </View>

        {/* Player card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            padding: spacing[5],
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing[3],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radii.md,
                backgroundColor: colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: fontSize.xl,
                  fontWeight: fontWeight.bold,
                }}
              >
                {profile.number}
              </Text>
            </View>
            <View style={{ flex: 1, gap: spacing[1] }}>
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.bold,
                }}
                accessibilityRole="header"
              >
                {profile.name}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                {profile.position} · {nat ? `${nat.flag} ${nat.name}` : 'Nacionalidad'}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                borderRadius: radii.pill,
                backgroundColor: colors.primary,
              }}
            >
              <Text
                style={{
                  color: colors.textOnPrimary,
                  fontSize: fontSize.md,
                  fontWeight: fontWeight.bold,
                }}
                accessibilityLabel={`Overall rating ${profile.ovr}`}
              >
                {copyHelpers.ovrChip(profile.ovr)}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {copy.resolve('dashboard_badge_age', { age: profile.age })} ·{' '}
            {profile.club ? profile.club.name : copy.resolve('dashboard_badge_value_free')}
          </Text>
        </View>

        {/* Stats row */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing[3],
          }}
        >
          <Stat label={copy.resolve('dashboard_stat_apps')} value={profile.stats.apps} />
          <Stat label={copy.resolve('dashboard_stat_goals')} value={profile.stats.goals} />
          <Stat label={copy.resolve('dashboard_stat_ast')} value={profile.stats.ast} />
        </View>

        {/* Trophy case (empty) */}
        <Section title={copy.resolve('dashboard_trophy_empty_h2')}>
          <View
            style={{
              borderRadius: radii.lg,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface2,
              padding: spacing[5],
              alignItems: 'center',
              gap: spacing[2],
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: fontSize.lg }}>🏆</Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: fontSize.sm,
                textAlign: 'center',
              }}
            >
              {copy.resolve('dashboard_trophy_empty_p')}
            </Text>
          </View>
        </Section>

        {/* Timeline — MGC-1504: render condicional. Carrera fresca →
            card motivador con CTA al draft. Carrera avanzada → tabla
            con filas reales del motor. Ver UX-006 audit-2026-09-04. */}
        <Section title={copy.resolve('dashboard_timeline_h2')}>
          {timelineHasContent ? (
            <View
              testID="dashboard-timeline-table"
              style={{
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  backgroundColor: colors.surface2,
                }}
                // FX1-B5 / MGC-1739 P1-6 — el header del timeline tenía
                // textos crípticos (EDAD/CLUB/OVR/APPS/G/AST) sin
                // accessibilityLabel. TalkBack/VoiceOver los leía como
                // letras sueltas sin contexto. Sumamos labels expandidos
                // para screen readers y preservamos el visual compacto
                // para usuarios visuales. Mismo patrón que el log timeline
                // de /temporada (accessibilityLabel por fila).
                accessibilityRole="header"
                accessibilityLabel="Timeline del jugador: edad, club, overall, partidos jugados, goles y asistencias por temporada"
              >
                <Text
                  style={[styles.colHeader, { color: colors.textMuted, fontSize: fontSize.xs }]}
                  accessibilityLabel="Edad"
                >
                  EDAD
                </Text>
                <Text
                  style={[styles.colHeader, { color: colors.textMuted, fontSize: fontSize.xs }]}
                  accessibilityLabel="Club"
                >
                  CLUB
                </Text>
                <Text
                  style={[styles.colHeader, styles.colNum, { color: colors.textMuted, fontSize: fontSize.xs }]}
                  accessibilityLabel="Overall"
                >
                  OVR
                </Text>
                <Text
                  style={[styles.colHeader, styles.colNum, { color: colors.textMuted, fontSize: fontSize.xs }]}
                  accessibilityLabel="Partidos jugados"
                >
                  APPS
                </Text>
                <Text
                  style={[styles.colHeader, styles.colNum, { color: colors.textMuted, fontSize: fontSize.xs }]}
                  accessibilityLabel="Goles"
                >
                  G
                </Text>
                <Text
                  style={[styles.colHeader, styles.colNum, { color: colors.textMuted, fontSize: fontSize.xs }]}
                  accessibilityLabel="Asistencias"
                >
                  AST
                </Text>
              </View>
              {log.timeline.map((row) => (
                <View
                  key={`${row.season}-${row.clubId}`}
                  style={{
                    flexDirection: 'row',
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Text style={[styles.colCell, { color: colors.text, fontSize: fontSize.sm }]}>
                    {row.age}
                  </Text>
                  <Text style={[styles.colCell, { color: colors.textMuted, fontSize: fontSize.sm }]}>
                    {row.clubName}
                  </Text>
                  <Text style={[styles.colCell, styles.colNum, { color: colors.text, fontSize: fontSize.sm }]}>
                    {row.ovr}
                  </Text>
                  <Text style={[styles.colCell, styles.colNum, { color: colors.text, fontSize: fontSize.sm }]}>
                    {row.apps}
                  </Text>
                  <Text style={[styles.colCell, styles.colNum, { color: colors.text, fontSize: fontSize.sm }]}>
                    {row.goals}
                  </Text>
                  <Text style={[styles.colCell, styles.colNum, { color: colors.text, fontSize: fontSize.sm }]}>
                    {row.assists}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View
              testID="dashboard-timeline-empty"
              style={{
                borderRadius: radii.lg,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface2,
                padding: spacing[5],
                alignItems: 'center',
                gap: spacing[2],
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.bold,
                  textAlign: 'center',
                }}
              >
                {copy.resolve('dashboard_timeline_fresh_h2')}
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: fontSize.sm,
                  textAlign: 'center',
                }}
              >
                {copy.resolve('dashboard_timeline_fresh_p')}
              </Text>
              {showDraftCta ? (
                <View style={{ marginTop: spacing[2], alignSelf: 'stretch' }}>
                  <Button
                    label="Empezar draft de leyendas"
                    onPress={onDraftPress}
                    variant="primary"
                    size="md"
                    testID="btn-dashboard-timeline-cta"
                  />
                </View>
              ) : null}
            </View>
          )}
        </Section>

        {/* National team */}
        <Section title={copy.resolve('dashboard_selection_h2')}>
          <Pressable
            onPress={() => undefined}
            style={{
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing[4],
              gap: spacing[2],
            }}
            accessibilityLabel={copy.resolve('dashboard_selection_empty')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
              <Text style={{ fontSize: 28 }}>{nat ? nat.flag : '🏳️'}</Text>
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  flex: 1,
                }}
              >
                {nat ? nat.name : copy.resolve('dashboard_selection_empty')}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>0 caps</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              {profile.career.reputation.seleccionConvocado
                ? copy.resolve('state_picked_national')
                : copy.resolve('dashboard_selection_empty')}
            </Text>
          </Pressable>
        </Section>

        {/* Recommended strategy (motor → UI sin hardcodeo) */}
        <Suspense fallback={null}>
          <RecommendedStrategy profile={profile} testID="dashboard-recommended" />
        </Suspense>

        {/* MGC-565 — affordance dev-only para reset de carrera. Solo
            visible bajo `__DEV__` o env flag; sin gate no renderiza. */}
        <ResetCareerButton />
      </ScrollView>
      {/* MGC-1388 — Sibling extract del bloque de CTAs a un footer fijo
          con alto reservado. Patrón validado en PR-337 (MGC-1381 temporada):
          `flexBasis` + `flexGrow:0` + `flexShrink:0` + `collapsable={false}`
          garantiza que UIAutomator reporte bounds reales para los botones
          sin scrollUntilVisible. MGC-1393 fix dentro del footer (no del
          ScrollView) con `size="md"` para mantener la altura 132dp reservada.
          PR-339 (e16571a) había movido los botones DENTRO del ScrollView con
          `size="lg"` para ocultar el CTA post-academy-back — eso eliminó el
          wrapper `dashboard-cta-footer` y rompió todos los flows Maestro que
          dependían de él. */}
      <View
        testID="dashboard-cta-footer"
        collapsable={false}
        style={{
          height: 132,
          flexBasis: 132,
          flexGrow: 0,
          flexShrink: 0,
          gap: spacing[2],
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        }}
      >
        <Button
          label={copy.resolve('dashboard_cta_match')}
          onPress={onAcademyPress}
          variant="primary"
          size="md"
          fullWidth
          testID="btn-dashboard-academy"
          accessibilityHint={copy.resolve('academy_h1')}
        />
        {showDraftCta ? (
          <Button
            label="Empezar draft de leyendas"
            onPress={onDraftPress}
            variant="secondary"
            size="md"
            fullWidth
            testID="btn-dashboard-draft"
            accessibilityHint="Inicia el draft de 8 rondas con leyendas"
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View style={{ gap: spacing[2] }}>
      <Text
        style={{
          color: colors.text,
          fontSize: fontSize.md,
          fontWeight: fontWeight.bold,
        }}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing[4],
        alignItems: 'center',
        gap: spacing[1],
      }}
    >
      <Text
        style={{
          color: colors.textStrong,
          fontSize: fontSize['2xl'],
          fontFamily: fontFamily.display,
          fontWeight: fontWeight.bold,
        }}
      >
        {value}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
  colHeader: {
    flex: 1,
    fontWeight: '600',
    letterSpacing: 1,
  },
  colCell: {
    flex: 1,
  },
  colNum: {
    textAlign: 'right',
  },
});