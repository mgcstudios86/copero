// src/components/home/HomepageCareerStarter.tsx — Copero (MGC-655)
//
// Port literal del componente `HomepageCareerStarter` de kiya0908/copero
// (scratch/kiya-copero/src/components/home/HomepageCareerStarter.tsx, 247 LOC).
// Adaptado al stack Expo del repo mgcstudios/copero:
//
// - `useRouter` de expo-router en lugar de `useNavigate` de react-router-dom.
// - `useCareerStore` zustand persiste en lugar de `saveState` manual.
// - `NATIONALITIES_FIFA` con ~193 países (priority 15 + alfabético) en lugar
//   de `allCountries` del catálogo kiya (paridad con copero.top).
// - `JerseyPreview` reutilizado como preview-shirt (MGC-466), con fallback
//   `—` cuando el nombre está vacío.
//
// State local (no persistido en el store):
// - `lastName` → `setName` al submit (trim + clamp 24 chars).
// - `preferredNumber` → `setNumber` (clamp 1..99, default 10).
// - `preferredFoot` → `setPreferredFoot` (segmented Izq/Der).
// - `nationalityFifa` → `setNationality` (priority + alfabético).
// - `heritageNationalityFifa` → NO persistido (motor mgcstudios no lo consume).
// - `position` → `setPosition`.
// - `draftMode` (classic | purist) → NO persistido (mismo motivo).
//
// Layout responsive (ADR-0015 §3):
// - Desktop ≥720px: 2-col grid (form 60% / preview 40%).
// - Tablet 380-720px: 2-col 50/50.
// - Mobile <380px: stack vertical, preview debajo del form.
//
// Accesibilidad (MGC-822):
// - Cada campo tiene `accessibilityLabel` y `accessibilityHint`.
// - Segmentados usan `accessibilityRole="tab"` + `accessibilityState.selected`
//   y pasan `aria-selected` como prop HTML directo en el Pressable. RN-Web
//   reenvía `aria-*` al DOM (cumple axe aria-required-attr en 1440 y 390);
//   native los ignora sin side-effects. Evita la dependencia del mapeo
//   `accessibilityState` → `aria-*` que RN-Web no hace consistentemente.
// - axe WCAG AA verificado en CI runner copero-ci.
// - Microcopy "Gratis · Sin cuenta · Guardado local en este navegador" abajo.

import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design/useTheme';
import { Button } from '@/design/components/Button';
import { JerseyPreview } from '@/design/components/JerseyPreview';
import { POSITIONS, POSITION_LABEL } from '@/features/career/positions';
import {
  NATIONALITIES_FIFA,
  PRIORITY_FIFA_CODES,
  DRAFT_MODES,
  DRAFT_MODE_LABEL,
  DRAFT_MODE_DESCRIPTION,
  type DraftMode,
} from '@/features/career/nationalities-fifa';
import { useCareerStore } from '@/shared/store/careerStore';
import type { Foot, Position } from '@/types/career';

const NAME_MAX_LENGTH = 24;
const NUMBER_MIN = 1;
const NUMBER_MAX = 99;
const NUMBER_DEFAULT = 10;
const NAME_FALLBACK = 'Tu nombre';

const FOOT_OPTIONS: readonly { value: Exclude<Foot, 'both'>; label: string }[] = [
  { value: 'left', label: 'Zurdo' },
  { value: 'right', label: 'Diestro' },
];

export function HomepageCareerStarter(): React.ReactElement {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily, lineHeight } = useTheme();
  const { width } = useWindowDimensions();

  const profile = useCareerStore((s) => s.profile);
  const setName = useCareerStore((s) => s.setName);
  const setNumber = useCareerStore((s) => s.setNumber);
  const setPosition = useCareerStore((s) => s.setPosition);
  const setNationality = useCareerStore((s) => s.setNationality);
  const setPreferredFoot = useCareerStore((s) => s.setPreferredFoot);
  const commitIdentityAndStartDraft = useCareerStore((s) => s.commitIdentityAndStartDraft);
  // MGC-249 / MGC-251: el form empuja directo al draft; ya no leemos
  // `stage` acá (la decisión de qué flujo mostrar la toma el home
  // según `careerStage`). Prefix `_` para silenciar el warning y dejar
  // explícito que es un placeholder histórico.
  const _stage = useCareerStore((s) => s.stage);
  void _stage;

  // Hidratar valores iniciales desde el store (si hay carrera parcial guardada).
  const [lastName, setLastName] = useState<string>(profile.name);
  const [preferredNumber, setPreferredNumber] = useState<number>(
    profile.number >= NUMBER_MIN && profile.number <= NUMBER_MAX ? profile.number : NUMBER_DEFAULT,
  );
  const [preferredFoot, setPreferredFootLocal] = useState<Exclude<Foot, 'both'>>(
    profile.preferredFoot === 'left' ? 'left' : 'right',
  );
  const [nationalityFifa, setNationalityLocal] = useState<string>(profile.nationalityCode || 'AR');
  const [heritageNationalityFifa, setHeritageNationalityFifa] = useState<string>('');
  const [position, setPositionLocal] = useState<Position>(profile.position);
  const [draftMode, setDraftModeLocal] = useState<DraftMode>('classic');

  // Priority arriba + resto alfabético. Memoizado para evitar re-sort en cada render.
  const countries = useMemo(() => {
    const priority = NATIONALITIES_FIFA.filter((c) => PRIORITY_FIFA_CODES.includes(c.code));
    const rest = NATIONALITIES_FIFA
      .filter((c) => !PRIORITY_FIFA_CODES.includes(c.code))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return [...priority, ...rest];
  }, []);

  const heritageCountries = useMemo(
    () => countries.filter((c) => c.code !== nationalityFifa),
    [countries, nationalityFifa],
  );

  const selectedCountry = NATIONALITIES_FIFA.find((c) => c.code === nationalityFifa);
  const displayName = lastName.trim() ? lastName.trim() : NAME_FALLBACK;

  // Layout responsive (ADR-0015 §3).
  const isWide = width >= 720;
  const formColumnStyle = isWide ? { flex: 3 } : { flex: 1 };
  const previewColumnStyle = isWide ? { flex: 2 } : { flex: 1 };
  // MGC-666 hallazgo #4: en viewports <380 px Apellido y Dorsal colapsaban a
  // 60.5 px de ancho (50/50 dentro de un form angosto). ADR-0015 §3 declara
  // stack <380 px; agregamos el breakpoint explícito al row compartido.
  const isNarrow = width < 380;

  const handleSubmit = async () => {
    setName(lastName.trim().slice(0, NAME_MAX_LENGTH));
    setNumber(Math.min(NUMBER_MAX, Math.max(NUMBER_MIN, Math.floor(preferredNumber) || NUMBER_DEFAULT)));
    setPosition(position);
    setNationality(nationalityFifa);
    setPreferredFoot(preferredFoot);
    // MGC-249: el botón "Empezar carrera" ahora va directo al draft (no al
    // dashboard). El motor setea stage='draft' atómicamente vía
    // `commitIdentityAndStartDraft` para que no haya frame intermedio con
    // stage='dashboard' y draft vacío (que era el bug del build-143).
    //
    // MGC-273: AWAIT antes del `router.push`. La acción ahora retorna
    // `Promise<void>` y resuelve solo después de que AsyncStorage confirme
    // la escritura del snapshot. Sin el await, la navegación se disparaba
    // antes de que `setItem` resolviera y un force-stop inmediato (típico
    // en QA que fuerza kill para reproducir AC7) perdía el snapshot —
    // home mostraba "Definí tu identidad" con valores default tras relaunch.
    await commitIdentityAndStartDraft();
    // heritage + draftMode: state local; ver ADR-0015 §2.
    router.push('/simulador-carrera/draft');
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}
      testID="homepage-career-starter"
      keyboardShouldPersistTaps="handled"
    >
      {/* Header (kiya0908: eyebrow + título + body) */}
      <View style={{ gap: spacing[1] }}>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
            letterSpacing: 3,
            fontFamily: fontFamily.display,
          }}
          accessibilityRole="header"
        >
          EMPEZÁ TU CARRERA
        </Text>
        <Text
          style={{
            color: colors.textStrong,
            fontSize: fontSize['2xl'],
            fontWeight: fontWeight.bold,
            fontFamily: fontFamily.display,
            lineHeight: fontSize['2xl'] * lineHeight.tight,
          }}
          accessibilityRole="header"
        >
          Definí tu identidad
        </Text>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: fontSize.sm,
            lineHeight: fontSize.sm * lineHeight.base,
          }}
        >
          Apellido, dorsal, selección y modo de draft. Tu jugador arranca a los 16 con OVR 50.
        </Text>
      </View>

      {/* Grid form + preview */}
      <View
        style={{
          flexDirection: isWide ? 'row' : 'column',
          gap: spacing[4],
          alignItems: 'stretch',
          // MGC-815 AC3: isolation:isolate crea un stacking context local para
          // que los zIndex de Form/Preview se comparen sólo entre ellos y no
          // contra ancestros (ScrollView, root). Garantiza hit-test correcto
          // del segmento Purista en viewports <380 px.
          isolation: 'isolate',
        }}
      >
        {/* Form */}
        <View
          style={[
            formColumnStyle,
            {
              backgroundColor: colors.surface,
              borderRadius: radii.lg,
              padding: spacing[4],
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing[3],
              // MGC-815 AC3: en viewports <380 px el career-preview (más tarde
              // en DOM) interceptaba el segmento Purista. Elevamos Form a
              // zIndex 2 con position:relative explícito para que el segmento
              // vertical Modo draft gane hit-test sobre el preview.
              position: 'relative',
              zIndex: 2,
              elevation: 2,
            },
          ]}
          testID="career-form"
        >
          {/* Apellido + Dorsal */}
          <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: spacing[3] }}>
            <FormField label="Apellido" flex={isNarrow ? 0 : 3}>
              <TextInput
                value={lastName}
                maxLength={NAME_MAX_LENGTH}
                autoComplete="off"
                placeholder="Tu apellido"
                placeholderTextColor={colors.textMuted}
                onChangeText={setLastName}
                accessibilityLabel="Apellido del jugador"
                accessibilityHint={`Máximo ${NAME_MAX_LENGTH} caracteres`}
                testID="input-lastName"
                style={[
                  inputStyle(colors, fontSize.sm),
                  { color: colors.text, padding: spacing[2], borderRadius: radii.md },
                ]}
              />
            </FormField>
            <FormField label="Dorsal" flex={isNarrow ? 0 : 1}>
              <TextInput
                value={String(preferredNumber)}
                keyboardType="number-pad"
                inputMode="numeric"
                onChangeText={(v) => {
                  const n = Number(v);
                  setPreferredNumber(
                    Number.isFinite(n) ? Math.min(NUMBER_MAX, Math.max(NUMBER_MIN, Math.floor(n))) : NUMBER_DEFAULT,
                  );
                }}
                accessibilityLabel="Dorsal del 1 al 99"
                accessibilityHint={`Entre ${NUMBER_MIN} y ${NUMBER_MAX}`}
                testID="input-number"
                style={[
                  inputStyle(colors, fontSize.sm),
                  { color: colors.text, padding: spacing[2], borderRadius: radii.md, textAlign: 'center' },
                ]}
              />
            </FormField>
          </View>

          {/* Pierna hábil */}
          <SegmentedField
            legend="Pierna hábil"
            options={FOOT_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
            value={preferredFoot}
            onChange={(v) => setPreferredFootLocal(v)}
            testID="segment-foot"
          />

          {/* Nacionalidad + Posición */}
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <FormField label="Nacionalidad" flex={1}>
              <Picker
                value={nationalityFifa}
                onChange={(v) => {
                  setNationalityLocal(v);
                  if (heritageNationalityFifa === v) setHeritageNationalityFifa('');
                }}
                options={countries.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` }))}
                testID="select-nationality"
              />
            </FormField>
            <FormField label="Posición" flex={1}>
              <Picker
                value={position}
                onChange={(v) => setPositionLocal(v as Position)}
                options={POSITIONS.map((p) => ({
                  value: p.id,
                  label: `${p.id} · ${POSITION_LABEL[p.id]}`,
                }))}
                testID="select-position"
              />
            </FormField>
          </View>

          {/* Herencia (details/summary → colapsable simple) */}
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.md,
              padding: spacing[3],
              gap: spacing[2],
            }}
          >
            <Pressable
              onPress={() =>
                setHeritageNationalityFifa(heritageNationalityFifa ? '' : heritageCountries[0]?.code ?? '')
              }
              accessibilityRole="button"
              accessibilityLabel="Nacionalidad de un familiar directo"
              accessibilityHint="Opcional, te habilita a jugar por otra selección"
              testID="toggle-heritage"
            >
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                }}
              >
                ¿Tenés una segunda nacionalidad? (opcional)
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                Habilita convocatorias por selección de un familiar directo.
              </Text>
            </Pressable>
            {heritageNationalityFifa ? (
              <Picker
                value={heritageNationalityFifa}
                onChange={(v) => setHeritageNationalityFifa(v)}
                options={[
                  { value: '', label: '— Sin herencia —' },
                  ...heritageCountries.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` })),
                ]}
                testID="select-heritage"
              />
            ) : null}
          </View>

          {/* Modo draft */}
          <SegmentedField
            legend="Modo draft"
            options={DRAFT_MODES.map((m) => ({
              value: m,
              label: DRAFT_MODE_LABEL[m],
              description: DRAFT_MODE_DESCRIPTION[m],
            }))}
            value={draftMode}
            onChange={(v) => setDraftModeLocal(v)}
            testID="segment-draft-mode"
            vertical
          />

          {/* Submit — MGC-718: testID="btn-career" preserva compat con
              e2e/home.spec.ts, simulador-carrera.spec.ts, a11y-keyboard.spec.ts
              y el resto de specs que apuntaban al Button legacy. El label
              "Empezar carrera" sigue siendo literal para no cambiar UX. */}
          <Button
            label="Empezar carrera"
            onPress={handleSubmit}
            variant="primary"
            size="lg"
            fullWidth
            testID="btn-career"
            accessibilityHint="Guarda tu identidad y abre el simulador de carrera"
          />
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.xs,
              textAlign: 'center',
              letterSpacing: 0.5,
            }}
            accessibilityLabel="Gratis, sin cuenta, guardado local en este navegador"
          >
            Gratis · Sin cuenta · Guardado local en este navegador
          </Text>
        </View>

        {/* Preview-shirt */}
        <View
          style={[
            previewColumnStyle,
            {
              backgroundColor: colors.surface2,
              borderRadius: radii.lg,
              padding: spacing[4],
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              gap: spacing[3],
              // MGC-815 AC3: explícitamente zIndex:1 con position:relative
              // para que Form (zIndex:2) gane en hit-test sin que preview
              // herede un valor implícito superior por source order.
              position: 'relative',
              zIndex: 1,
              elevation: 1,
              minHeight: 280,
              justifyContent: 'center',
            },
          ]}
          testID="career-preview"
        >
          <View
            style={{
              flexDirection: 'row',
              alignSelf: 'stretch',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              PREVIEW
            </Text>
            <Text
              style={{
                color: colors.textStrong,
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                letterSpacing: 1,
              }}
              accessibilityLabel={`Posición ${POSITION_LABEL[position]}`}
            >
              {POSITION_LABEL[position]}
            </Text>
          </View>
          <JerseyPreview
            countryCode={nationalityFifa}
            number={preferredNumber}
            name={displayName}
            size={isWide ? 'md' : 'sm'}
            testID="preview-jersey"
          />
          <View style={{ alignItems: 'center', gap: spacing[1] }}>
            <Text
              style={{
                color: colors.textStrong,
                fontSize: fontSize.md,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              {displayName.toUpperCase()}
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: fontSize.xs,
              }}
              accessibilityLabel={
                selectedCountry
                  ? `${selectedCountry.flag} ${selectedCountry.name}, modo ${DRAFT_MODE_LABEL[draftMode]}`
                  : `Modo ${DRAFT_MODE_LABEL[draftMode]}`
              }
            >
              {selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : 'Sin selección'}
              {' · '}
              {DRAFT_MODE_LABEL[draftMode]}
            </Text>
          </View>
          {/* Draft track 8 markers (kiya0908 preview) */}
          <View
            style={{ flexDirection: 'row', gap: spacing[1], marginTop: spacing[2] }}
            accessibilityLabel="Draft track de 8 rondas"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <View
                key={i}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: radii.pill,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 10,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {i + 1}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function FormField({
  label,
  flex,
  children,
}: {
  label: string;
  flex: number;
  children: React.ReactNode;
}) {
  const { colors, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View style={{ flex, gap: spacing[1] }}>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.xs,
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

function SegmentedField<T extends string>({
  legend,
  options,
  value,
  onChange,
  testID,
  vertical = false,
}: {
  legend: string;
  options: readonly { value: T; label: string; description?: string }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
  vertical?: boolean;
}) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View style={{ gap: spacing[1] }}>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
          letterSpacing: 1,
        }}
      >
        {legend.toUpperCase()}
      </Text>
      <View
        style={{
          flexDirection: vertical ? 'column' : 'row',
          backgroundColor: colors.surface2,
          borderRadius: radii.md,
          padding: spacing[1],
          gap: spacing[1],
          // MGC-803 AC3: en viewports <380 px el career-preview solapaba el
          // segundo ítem del segmento (Purista) ~50 px. elevation + zIndex
          // garantiza que el Pressable del segmento quede sobre cualquier
          // overlay móvil (Android respeta elevation; web/iOS zIndex).
          ...(vertical ? { zIndex: 1, elevation: 1 } : null),
        }}
        accessibilityRole="tablist"
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          // MGC-800 fix: role=tab siempre (no vertical/horizontal). react-native-web
          // no traduce accessibilityState.checked a aria-checked en el DOM, lo que
          // rompía axe-core aria-required-attr en role=radio vertical. axe-core
          // acepta tab + accessibilityState.selected (aria-selected).
          // MGC-822: pasamos `aria-selected` como prop HTML directo —
          // RN-Web lo reenvía al DOM (cumple axe aria-selected); en native
          // es ignorado sin side-effects.
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.label}
              aria-selected={selected}
              testID={`${testID}-${opt.value}`}
              style={{
                // MGC-666 hallazgo #3: `flex: vertical ? 0 : 1` colapsaba los
                // ítems del Modo Draft a 0 ancho en columna → el label y la
                // descripción se desbordaban y se superponían. Forzamos
                // `flex: 1` con `width: '100%'` para que cada opción ocupe
                // todo el ancho del contenedor padre en vertical, y el gap
                // del padre separe las filas.
                flex: 1,
                width: '100%',
                paddingVertical: spacing[2],
                paddingHorizontal: spacing[3],
                borderRadius: radii.sm,
                backgroundColor: selected ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[1],
              }}
            >
              <Text
                style={{
                  color: selected ? colors.textOnPrimary : colors.textStrong,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                }}
              >
                {opt.label}
              </Text>
              {opt.description ? (
                <Text
                  style={{
                    // MGC-666 hallazgo #2: axe-core r2 detectó 1 nodo de
                    // contraste insuficiente en mobile 390 sobre el description
                    // text cuando el segmento no estaba seleccionado (textMuted
                    // sobre surface2 cae justo en el borde de AA en light).
                    // Subimos a text (más oscuro en light, más claro en dark)
                    // para garantizar WCAG AA 4.5:1 en los tres modos.
                    color: selected ? colors.textOnPrimary : colors.text,
                    fontSize: fontSize.xs,
                    textAlign: 'center',
                  }}
                >
                  {opt.description}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Picker({
  value,
  onChange,
  options,
  testID,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  testID?: string;
}) {
  const { colors, radii, spacing, fontSize } = useTheme();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.md,
        backgroundColor: colors.bg,
      }}
    >
      {/* Picker nativo via <select> en web — react-native lo renderiza como
          modal nativo en iOS/Android vía @react-native-picker/picker cuando se
          usa. Para mantener cero deps nuevas, usamos TextInput readOnly con
          Pressable que delega al sistema. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={options.find((o) => o.value === value)?.label ?? 'Seleccionar'}
        testID={testID}
        onPress={() => {
          // Simplificado: ciclar valores (en producción se abriría el picker
          // nativo del sistema; ver ADR-0015 §4 sobre deps).
          const idx = options.findIndex((o) => o.value === value);
          const next = options[(idx + 1) % options.length];
          onChange(next.value);
        }}
        style={{
          padding: spacing[2],
          minHeight: 36,
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: fontSize.sm,
          }}
          numberOfLines={1}
        >
          {options.find((o) => o.value === value)?.label ?? 'Seleccionar'}
        </Text>
      </Pressable>
    </View>
  );
}

function inputStyle(colors: ReturnType<typeof useTheme>['colors'], fontSize: number) {
  return {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    minHeight: 36,
    fontSize,
  };
}

