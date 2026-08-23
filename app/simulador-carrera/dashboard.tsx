import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useCareerStore } from '@/shared/store/careerStore';
import { NATIONALITIES_BY_CODE } from '@/features/career/nationalities';

export default function DashboardScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const profile = useCareerStore((s) => s.profile);
  const openAcademy = useCareerStore((s) => s.openAcademy);

  const nat = NATIONALITIES_BY_CODE[profile.nationalityCode];

  // Placeholder timeline rows 16..38 con OVR/APPS/GOALS/AST
  const timelineRows = Array.from({ length: 38 - 16 + 1 }, (_, i) => {
    const age = 16 + i;
    return { age, ovr: profile.ovr, apps: 0, goals: 0, ast: 0, club: 'Free agent' };
  });

  const onAcademyPress = () => {
    openAcademy();
    router.push('/simulador-carrera/academy');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[5], padding: spacing[4] }]}
        testID="dashboard-screen"
      >
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
              >
                {profile.ovr} OVR
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            Edad {profile.age} · {profile.club ? profile.club.name : 'Free agent'}
          </Text>
        </View>

        {/* Stats row */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing[3],
          }}
        >
          <Stat label="Apps" value={profile.stats.apps} />
          <Stat label="Goals" value={profile.stats.goals} />
          <Stat label="Ast" value={profile.stats.ast} />
        </View>

        {/* Trophy case (empty) */}
        <Section title="Trofeos">
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
              Aún sin títulos. Tu vitrina se llena a medida que ganes copas.
            </Text>
          </View>
        </Section>

        {/* Timeline */}
        <Section title="Timeline">
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
        <Section title="Selección nacional">
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
            accessibilityLabel="Selección nacional, aún sin convocatoria"
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
                {nat ? nat.name : 'Sin selección'}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>0 caps</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              Debut convocado cuando tu OVR supere el umbral de la selección.
            </Text>
          </Pressable>
        </Section>

        <Button
          label="Ver oferta del academy"
          onPress={onAcademyPress}
          variant="primary"
          size="lg"
          fullWidth
          testID="btn-dashboard-academy"
          accessibilityHint="Abre la pantalla de oferta del academy"
        />
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