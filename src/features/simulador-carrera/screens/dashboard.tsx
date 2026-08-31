import React, { Suspense, lazy } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { copy, copyHelpers } from '@/design/copy/es-AR/simulador-carrera';
import { useCareerStore } from '@/shared/store/careerStore';
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

export default function DashboardScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const profile = useCareerStore((s) => s.profile);
  const stage = useCareerStore((s) => s.stage);
  const openAcademy = useCareerStore((s) => s.openAcademy);
  const startDraft = useCareerStore((s) => s.startDraft);

  const nat = NATIONALITIES_BY_CODE[profile.nationalityCode];

  // Placeholder timeline rows 16..38 con OVR/APPS/GOALS/AST
  const timelineRows = Array.from({ length: 38 - 16 + 1 }, (_, i) => {
    const age = 16 + i;
    return {
      age,
      ovr: profile.ovr,
      apps: 0,
      goals: 0,
      ast: 0,
      club: profile.club?.name ?? copy.resolve('dashboard_badge_value_free'),
    };
  });

  // Lazy-load del bloque "Estrategia recomendada" (MGC-482):
  // el cálculo `recommendStrategy(profile)` + `strategyCopy` corre dentro
  // del chunk diferido; el inicial sólo importa la firma del componente.
  // Ver <RecommendedStrategy> abajo.

  const onAcademyPress = () => {
    openAcademy();
    router.push('/simulador-carrera/academy');
  };

  // MGC-209: CTA al flow de 6 pantallas (draft → tu-jugador → club → temporada → fin-carrera).
  // Se muestra cuando el jugador todavía no pasó por el draft. Permite acceder
  // a las pantallas MGC-209 sin romper el flow legacy academy → match.
  // MGC-284: `startDraft` ahora es async + await flushPendingSave; el
  // await acá garantiza que el board + stage='draft' queden en disco
  // antes de navegar — patrón idéntico al de `commitIdentityAndStartDraft`
  // en HomepageCareerStarter (MGC-273).
  const showDraftCta = stage === 'dashboard' || stage === 'identity';
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
            <JerseyPreview
              countryCode={profile.nationalityCode}
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

        {/* Timeline */}
        <Section title={copy.resolve('dashboard_timeline_h2')}>
          <View
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
            >
              <Text style={[styles.colHeader, { color: colors.textMuted, fontSize: fontSize.xs }]}>
                EDAD
              </Text>
              <Text style={[styles.colHeader, { color: colors.textMuted, fontSize: fontSize.xs }]}>
                CLUB
              </Text>
              <Text style={[styles.colHeader, styles.colNum, { color: colors.textMuted, fontSize: fontSize.xs }]}>
                OVR
              </Text>
              <Text style={[styles.colHeader, styles.colNum, { color: colors.textMuted, fontSize: fontSize.xs }]}>
                APPS
              </Text>
              <Text style={[styles.colHeader, styles.colNum, { color: colors.textMuted, fontSize: fontSize.xs }]}>
                G
              </Text>
              <Text style={[styles.colHeader, styles.colNum, { color: colors.textMuted, fontSize: fontSize.xs }]}>
                AST
              </Text>
            </View>
            {timelineRows.map((row) => (
              <View
                key={row.age}
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
                  {row.club}
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
                  {row.ast}
                </Text>
              </View>
            ))}
          </View>
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

        <Button
          label={copy.resolve('dashboard_cta_match')}
          onPress={onAcademyPress}
          variant="primary"
          size="lg"
          fullWidth
          testID="btn-dashboard-academy"
          accessibilityHint={copy.resolve('academy_h1')}
        />
        {showDraftCta ? (
          <Button
            label="Empezar draft de leyendas"
            onPress={onDraftPress}
            variant="secondary"
            size="lg"
            fullWidth
            testID="btn-dashboard-draft"
            accessibilityHint="Inicia el draft de 8 rondas con leyendas"
          />
        ) : null}
        {/* MGC-565 — affordance dev-only para reset de carrera. Solo
            visible bajo `__DEV__` o env flag; sin gate no renderiza. */}
        <ResetCareerButton />
      </ScrollView>
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