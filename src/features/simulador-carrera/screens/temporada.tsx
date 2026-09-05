import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useCareerStore } from '@/shared/store/careerStore';
import { RETIREMENT_AGE } from '@/features/career/season';
import { NATIONALITIES_BY_CODE } from '@/features/career/nationalities';
import {
  ESTILO_RASGOS,
  YEARLY_PLAN_MODIFIERS,
  type EstiloRasgo,
  type YearlyPlan,
} from '@/types/career';

/**
 * MGC-209 [5/6] — TEMPORADA.
 *
 * Replica `copero-web/web/src/screens/Temporada.tsx`: bloque izquierdo
 * con edad, club, OVR, valor, stats y selección; timeline derecha con
 * todas las temporadas registradas. Las filas se derivan de
 * `state.log.timeline` (motor) más un placeholder hasta RETIREMENT_AGE
 * para que la grilla siempre tenga la misma densidad visual.
 */
export default function TemporadaScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const profile = useCareerStore((s) => s.profile);
  const log = useCareerStore((s) => s.log);
  const stage = useCareerStore((s) => s.stage);
  const advanceSeason = useCareerStore((s) => s.advanceSeason);
  const runCareerToRetirement = useCareerStore((s) => s.runCareerToRetirement);
  // MGC-249: loop semanal con `advance()` para drenar lesión, bumpear
  // semana y rotar season cada 38 semanas. Botón "Siguiente semana"
  // abre el loop fino que QA necesita para validar feedback bar.
  const advance = useCareerStore((s) => s.advance);
  // MGC-1017: acción para fijar el plan anual (UI picker abajo).
  const setYearlyPlan = useCareerStore((s) => s.setYearlyPlan);
  const currentPlan = profile.career.yearlyPlan;
  // MGC-1505: rasgos opt-in (multi-select, cap 2). Persistido en
  // `profile.career.estilo` y consumido por el motor cuando corresponda.
  const setEstilo = useCareerStore((s) => s.setEstilo);
  const estilo: EstiloRasgo[] = useMemo(
    () => profile.career.estilo ?? [],
    [profile.career.estilo],
  );

  // MGC-1505 — toggle de rasgo. La lista ya viene toggled (on tap
  // off, off tap on); cap 2 lo enforce el reducer defensivo + UI
  // deshabilita el 3er tap.
  const onToggleRasgo = useCallback(
    (rasgo: EstiloRasgo) => {
      const isOn = estilo.includes(rasgo);
      const next = isOn ? estilo.filter((r) => r !== rasgo) : [...estilo, rasgo].slice(0, 2);
      void setEstilo(next);
    },
    [estilo, setEstilo],
  );

  // MGC-1769 — fallback 'AR' cosmético; en /temporada nationalityCode
  // ya está seleccionado (gate exige no-null antes de commitIdentity).
  const nat = NATIONALITIES_BY_CODE[profile.nationalityCode ?? 'AR'];

  // Construye filas de timeline: las del log + placeholders hasta retiro.
  const startAge = profile.age - (log?.timeline.length ?? 0);
  const endAge = RETIREMENT_AGE;
  const ages: number[] = [];
  for (let a = startAge; a <= endAge; a++) ages.push(a);

  const rowFor = (age: number) => log?.timeline.find((r) => r.age === age);

  const onAdvance = async () => {
    // MGC-284: `advanceSeason` ahora es async + await flushPendingSave.
    // No navegamos inmediatamente después, pero bloqueamos el handler
    // hasta que AsyncStorage confirme la rotación de temporada + log
    // (AC4 — 8 rounds + force-stop).
    await advanceSeason();
  };

  const onRunAll = async () => {
    // MGC-257/MGC-284: la última transición del flow ya esperaba
    // flushPendingSave; el cambio de firma a Promise<void> es lo único
    // que nos toca acá.
    await runCareerToRetirement();
  };

  // MGC-249: loop semanal fino. Dispara `advance()` que drena lesión
  // (1 fecha → -1) y bumpea week. Cuando week llega a 38, advanceSeason
  // se hace cargo (rotación de temporada + stats anuales).
  const onNextWeek = async () => {
    // MGC-284: `advance` ahora es async + await flushPendingSave.
    // Antes fire-and-forget; ahora cada "Siguiente semana" bloquea
    // hasta confirmar la rotación de week/lesión en AsyncStorage.
    await advance();
  };

  const onRetire = () => {
    if (stage === 'retirement') {
      router.replace('/simulador-carrera/fin-carrera');
    }
  };

  useEffect(() => {
    if (stage === 'retirement') {
      router.replace('/simulador-carrera/fin-carrera');
    }
  }, [stage, router]);

  // MGC-1381 — presupuesto vertical exacto del `temporada-cta-footer`.
  // Cada `Button size="lg"` mide minHeight = max(52, tapTarget) = 52dp
  // (ver src/design/components/Button.tsx#dims). Reservamos
  // n*52 + (n-1)*gap(8) + paddingVertical(8)*2 para que Yoga NO tenga que
  // medir el contenido: sin height explícito el sibling fijo vuelve a
  // depender del measure pass y reaparece el clipping (MGC-1339).
  const CTA_HEIGHT = 52;
  const ctaCount = stage === 'retirement' ? 4 : 3;
  const ctaFooterHeight =
    ctaCount * CTA_HEIGHT + (ctaCount - 1) * spacing[2] + spacing[2] * 2;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          {
            gap: spacing[5],
            padding: spacing[4],
            // MGC-1381: el paddingBottom +156 de PR-336 ya no hace falta —
            // los CTAs salieron del ScrollView a `temporada-cta-footer`
            // (sibling fijo), así que no hay nada que rescatar del borde
            // inferior del viewport. Queda el padding simétrico.
          },
        ]}
        testID="temporada-screen"
      >
        {/* Hero block */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[4],
            gap: spacing[3],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={{
                color: colors.textStrong,
                fontSize: fontSize['3xl'],
                fontWeight: fontWeight.bold,
              }}
              accessibilityLabel={`Overall rating ${profile.ovr}`}
            >
              {profile.ovr}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'flex-end' }}>
              <Pill label={nat ? `${nat.flag} ${nat.code}` : '—'} bg={colors.surface2} fg={colors.textMuted} />
              <Pill label={`#${profile.number} ${profile.position}`} bg={colors.primary} fg={colors.textOnPrimary} />
              <Pill
                label={profile.club?.name ?? 'Free agent'}
                bg={colors.surface2}
                fg={colors.textMuted}
              />
            </View>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {nat ? nat.name : 'Nacionalidad'} · Escenario regional
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <Tile label="EDAD" value={`${profile.age}`} />
            <Tile label="VALOR" value={`${profile.value} M US$`} valueColor={colors.primary} />
          </View>

          <View style={{ flexDirection: 'row', gap: spacing[3], alignItems: 'center' }}>
            <Stat icon="🧮" value={profile.stats.apps} label="P" />
            <Stat icon="⚽" value={profile.stats.goals} label="G" />
            <Stat icon="📈" value={profile.stats.ast} label="A" />
          </View>

          {/* Selección */}
          <View
            style={{
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface2,
              padding: spacing[3],
              gap: spacing[1],
            }}
          >
            <Text style={{ color: colors.textStrong, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
              SELECCIÓN · {nat?.code ?? '—'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
              {profile.career.reputation.seleccionConvocado
                ? 'Convocado a selección mayor.'
                : 'Sin convocatorias todavía'}
            </Text>
          </View>

          {/* Vitrina placeholder */}
          <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>🏆</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, letterSpacing: 2, fontWeight: fontWeight.bold }}>
              VITRINA VACÍA
            </Text>
          </View>
        </View>

        {/* Estilo del jugador */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[4],
            gap: spacing[3],
          }}
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 10,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            TU ESTILO DE JUGADOR
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
            }}
          >
            ELEGÍ HASTA 2 RASGOS
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            Cambian eventos, ofertas y desarrollo. Seleccioná 1 o 2.
          </Text>
          {/* MGC-1505 — Rasgos como Pressable toggle (cap 2). El 3er tap
              sobre un rasgo no-seleccionado cuando ya hay 2 elegidos
              queda deshabilitado (defensa UI; el reducer también cap-a
              defensivamente). El Pill refleja el contador global
              `${seleccionados} / 2` y se pone verde cuando hay al menos
              uno elegido. */}
          {ESTILO_RASGOS.map((rasgo) => {
            const selected = estilo.includes(rasgo);
            const atCap = !selected && estilo.length >= 2;
            return (
              <Pressable
                key={rasgo}
                onPress={() => onToggleRasgo(rasgo)}
                disabled={atCap}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: atCap }}
                accessibilityLabel={`Rasgo ${rasgo}${selected ? ' seleccionado' : ' no seleccionado'}`}
                testID={`btn-estilo-${rasgo}`}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing[2],
                  paddingHorizontal: spacing[3],
                  borderRadius: radii.md,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.surface2 : colors.surface,
                  opacity: atCap ? 0.4 : 1,
                  minHeight: 48,
                }}
              >
                <Text
                  style={{
                    color: colors.textStrong,
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.bold,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                  }}
                >
                  {rasgo === 'magneto-mediatico' ? 'MAGNATE-MEDIÁTICO' : rasgo.toUpperCase()}
                </Text>
                <Pill
                  label={`${estilo.length} / 2`}
                  bg={estilo.length > 0 ? colors.primary : colors.surface2}
                  fg={estilo.length > 0 ? colors.textOnPrimary : colors.textMuted}
                />
              </Pressable>
            );
          })}
        </View>

        {/* MGC-1381: los CTAs del loop viven ahora en
            `temporada-cta-footer`, sibling fijo del ScrollView (abajo del
            cierre de este ScrollView). Ver comentario allá para la causa
            raíz del colapso a 9dp. */}

        {/* MGC-1017 — Decisión anual. Tres planes (agresivo / mantener /
            cuidarse) que modifican el drift OVR y la chance de lesión del
            PRÓXIMO advanceSeason. Aparece siempre que NO estamos en
            retiro; si ya hay un plan elegido se muestra como confirmación
            + permite re-cambiarlo antes de avanzar. */}
        <YearlyPlanPicker
          currentPlan={currentPlan}
          disabled={stage === 'retirement'}
          onPick={setYearlyPlan}
        />

        {/* MGC-251 — Resumen del último partido/temporada jugada. Se muestra
            cuando hay al menos una fila en el timeline: partidos, goles y
            asist de la última temporada para confirmar el match results. */}
        {log && log.timeline.length > 0 ? (
          <View
            testID="temporada-last-season"
            accessibilityLabel={`Última temporada: edad ${profile.age}, OVR ${profile.ovr}, partidos ${log.timeline[log.timeline.length - 1].apps}, goles ${log.timeline[log.timeline.length - 1].goals}, asist ${log.timeline[log.timeline.length - 1].assists}`}
            style={{
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.primary,
              backgroundColor: colors.primarySoft,
              padding: spacing[4],
              gap: spacing[2],
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              ÚLTIMA TEMPORADA JUGADA
            </Text>
            <View
              style={{
                flexDirection: 'row',
                gap: spacing[3],
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize.xl,
                  fontWeight: fontWeight.bold,
                }}
              >
                {log.timeline[log.timeline.length - 1].apps} P ·{' '}
                {log.timeline[log.timeline.length - 1].goals} G ·{' '}
                {log.timeline[log.timeline.length - 1].assists} A
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: fontSize.xs,
                }}
              >
                OVR {log.timeline[log.timeline.length - 1].ovr} · {log.timeline[log.timeline.length - 1].clubName}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Timeline */}
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
          <View style={{ flexDirection: 'row', gap: spacing[2], paddingBottom: spacing[2] }}>
            <Text
              style={{
                flex: 1,
                color: colors.textMuted,
                fontSize: 10,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              EDAD
            </Text>
            <Text
              style={{
                flex: 2,
                color: colors.textMuted,
                fontSize: 10,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              CLUB
            </Text>
            <Text
              style={{
                flex: 1,
                textAlign: 'right',
                color: colors.textMuted,
                fontSize: 10,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              OVR
            </Text>
            <Text
              style={{
                flex: 1.5,
                textAlign: 'right',
                color: colors.textMuted,
                fontSize: 10,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              P / G / A
            </Text>
          </View>
          {ages.map((age) => {
            const row = rowFor(age);
            return (
              <View
                key={age}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                  paddingVertical: spacing[2],
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    width: 32,
                    height: 32,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                    }}
                  >
                    {age}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 2,
                    color: row ? colors.textStrong : colors.textMuted,
                    fontSize: fontSize.sm,
                  }}
                >
                  {row?.clubName ?? '—'}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    textAlign: 'right',
                    color: row ? colors.textStrong : colors.textMuted,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {row ? row.ovr : '—'}
                </Text>
                <Text
                  style={{
                    flex: 1.5,
                    textAlign: 'right',
                    color: row ? colors.textMuted : colors.textMuted,
                    fontSize: fontSize.xs,
                  }}
                >
                  {row ? `${row.apps} / ${row.goals} / ${row.assists}` : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* MGC-251 — CTAs del loop. "Jugar temporada" avanza 1 temporada
          (simula partidos, evoluciona OVR año a año) y "Retirarme" corre
          la carrera hasta el retiro + navega al resumen de fin de carrera.
          MGC-249: "Siguiente semana" es el loop semanal fino previo al
          botón anual.

          MGC-1381 — CAUSA RAÍZ del colapso a 9dp. PR-336 (0ac3c76) intentó
          arreglarlo con `flexDirection: column` + `flexShrink: 0` en cada
          hijo DENTRO del ScrollView y QA MGC-1378 volvió a medir
          `btn-temporada-play` en [40,2121][1040,2130] (h=9dp). El
          `flexShrink` no puede ser la causa: `Button` fuerza
          `minHeight: max(52, tapTarget)` = 52dp, así que 9dp no es un
          layout válido de Yoga — es el clipping de RN-Android sobre los
          descendientes del ScrollView cuya y1 cae más allá del borde
          inferior del viewport (UIAutomator reporta
          `getBoundsInScreen()` recortado, no la altura medida). El
          `paddingBottom: +156` de PR-336 alargaba el contenido pero no
          movía el botón dentro del viewport, y el `<Banner />` del root
          layout (`app/_layout.native.tsx`) es un sibling flex — no
          superpone, así que ese padding era espacio muerto.

          Fix = mismo patrón probado en identity (MGC-807 field-map-section,
          MGC-843 nationality-section, MGC-1351 identity-fixed-form): sacar
          el bloque del ScrollView y montarlo como sibling fijo con
          `height` + `flexBasis` + `flexGrow: 0` + `flexShrink: 0` para que
          Yoga reserve el alto exacto y los bounds no dependan del measure
          pass del ScrollView ni de la posición de scroll. Los CTAs quedan
          siempre visibles y tappables arriba del Banner. */}
      <View
        testID="temporada-cta-footer"
        collapsable={false}
        style={{
          height: ctaFooterHeight,
          flexBasis: ctaFooterHeight,
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
          // FX1-B5 / MGC-1739 P1-8 — el catálogo marcó "Siguiente semana
          // (2/38)" como "paréntesis raro en español". El paréntesis
          // alargado en label de CTA choca con la convención es-AR del
          // producto (el resto del flow usa middot · para separar
          // magnitudes, ver semanal.tsx SEMANA {week}/38 · {position}).
          // Cambio a middot, mismo dato, lectura más natural.
          label={`Siguiente semana · ${profile.week}/38`}
          onPress={onNextWeek}
          variant="primary"
          size="lg"
          fullWidth
          testID="btn-temporada-next-week"
          disabled={stage === 'retirement'}
          accessibilityHint="Avanza una semana de la temporada: drena lesión y rota eventos semanales"
        />
        <Button
          label="Jugar temporada"
          onPress={onAdvance}
          variant="secondary"
          size="lg"
          fullWidth
          testID="btn-temporada-play"
          disabled={stage === 'retirement'}
          accessibilityHint="Simula una temporada de partidos y evoluciona OVR, edad y stats"
        />
        <Button
          label="Retirarme"
          onPress={onRunAll}
          variant="secondary"
          size="lg"
          fullWidth
          testID="btn-temporada-retire"
          disabled={stage === 'retirement'}
          accessibilityHint="Cierra la carrera y abre el resumen final con partidos, goles, asist y OVR final"
        />
        {stage === 'retirement' ? (
          <Button
            label="Ver fin de carrera"
            onPress={onRetire}
            variant="primary"
            size="lg"
            fullWidth
            testID="btn-temporada-retire-summary"
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  const { radii, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1],
        borderRadius: radii.pill,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: fg, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>{label}</Text>
    </View>
  );
}

function Tile({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface2,
        padding: spacing[3],
        gap: spacing[1],
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 10,
          fontWeight: fontWeight.bold,
          letterSpacing: 2,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: valueColor ?? colors.textStrong,
          fontSize: fontSize.lg,
          fontWeight: fontWeight.bold,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: string; value: number; label: string }) {
  const { colors, spacing, fontSize } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
      <Text style={{ fontSize: fontSize.base }}>{icon}</Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{value} {label}</Text>
    </View>
  );
}

/**
 * MGC-1017 — YearlyPlanPicker. Tres opciones (agresivo / mantener /
 * cuidarse). La elección se persiste en `profile.career.yearlyPlan` y
 * la consume el próximo `advanceSeason`. Si ya hay plan elegido, los
 * botones resaltan la opción activa.
 *
 * Acceptance criteria del parent (MGC-1017):
 * - Dos carreras con planes distintos -> timelines distintos.
 * - La decisión se exige antes de avanzar de temporada (UX gating).
 */
function YearlyPlanPicker({
  currentPlan,
  disabled,
  onPick,
}: {
  currentPlan: YearlyPlan | undefined;
  disabled: boolean;
  onPick: (p: YearlyPlan) => void | Promise<void>;
}) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const plans: YearlyPlan[] = ['agresivo', 'mantener', 'cuidarse'];

  return (
    <View
      testID="temporada-yearly-plan"
      style={{
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing[4],
        gap: spacing[3],
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 10,
          fontWeight: fontWeight.bold,
          letterSpacing: 2,
        }}
      >
        DECISIÓN ANUAL
      </Text>
      <Text
        style={{
          color: colors.textStrong,
          fontSize: fontSize.md,
          fontWeight: fontWeight.bold,
        }}
      >
        ¿CÓMO ENCARAR EL AÑO QUE VIENE?
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
        Tu plan modifica el drift OVR y la chance de lesión del próximo
        ciclo. Se resetea al cierre de cada temporada para que elijas de
        nuevo.
      </Text>
      <View style={{ gap: spacing[2] }}>
        {plans.map((p) => {
          const m = YEARLY_PLAN_MODIFIERS[p];
          const isSelected = currentPlan === p;
          return (
            <Button
              key={p}
              label={`${m.label}${isSelected ? ' ✓' : ''}`}
              onPress={() => onPick(p)}
              variant={isSelected ? 'primary' : 'secondary'}
              size="md"
              fullWidth
              testID={`btn-yearly-plan-${p}`}
              disabled={disabled}
              accessibilityHint={m.copy}
            />
          );
        })}
      </View>
      {currentPlan ? (
        <Text
          style={{
            color: colors.primary,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
          }}
        >
          {YEARLY_PLAN_MODIFIERS[currentPlan].copy}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // MGC-1381: el ScrollView comparte el viewport con `temporada-cta-footer`.
  // flex:1 + flexShrink:1 le deja tomar el remanente después de que el
  // footer reserva su alto fijo.
  scroll: { flex: 1, flexShrink: 1 },
  container: {},
});
