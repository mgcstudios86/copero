/**
 * Pantalla de resultado del Ideología Futbolística.
 *
 * Muestra:
 *   - Compass 2D con el punto del usuario + arquetipos cercanos.
 *   - Card con el DT más parecido (nombre, tag, color, bio, % afinidad).
 *   - Botón para compartir (delegado a `lib/share.ts`).
 *   - Botón para reiniciar.
 *
 * La captura PNG para share se hace desde acá: en web via `html-to-image`,
 * en nativo via `react-native-view-shot`.
 */

import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/features/ui';
import { colors, radii, spacing } from '@/features/ui/theme';
import { useQuizStore, answeredList } from '@/state/quizStore';
import { computeResult, type CompassResult } from '@/lib/compass';
import { ARCHETYPES } from '@/data/archetypes';
import { shareResult } from '@/lib/share';

type Props = {
  onRestart: () => void;
};

export const ResultScreen = ({ onRestart }: Props) => {
  const answers = useQuizStore((s) => s.answers);
  const reset = useQuizStore((s) => s.reset);

  const result = useMemo<CompassResult | null>(() => {
    const list = answeredList(answers);
    if (list.length !== 15) return null;
    return computeResult(list);
  }, [answers]);

  const captureRef = useRef<View | null>(null);
  const [sharing, setSharing] = useState(false);

  const onShare = async () => {
    if (!result) return;
    setSharing(true);
    try {
      const pngUri = await capturePng(captureRef);
      await shareResult({ result, pngUri });
    } finally {
      setSharing(false);
    }
  };

  const handleRestart = () => {
    reset();
    onRestart();
  };

  if (!result) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.container, { flex: 1, justifyContent: 'center' }]}>
          <Text style={styles.title}>Faltan respuestas</Text>
          <Text style={styles.subtitle}>
            Volvé a empezar y respondé las 15 preguntas.
          </Text>
          <Button label="Volver" onPress={handleRestart} />
        </View>
      </SafeAreaView>
    );
  }

  const arch = result.nearestArchetype;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View ref={captureRef} collapsable={false} style={styles.shareSurface}>
          <CompassView x={result.x} y={result.y} />
          <View style={[styles.archCard, { borderColor: arch.color }]}>
            <Text style={styles.eyebrow}>Tu DT más parecido</Text>
            <View style={styles.archHeader}>
              <View style={[styles.archTag, { backgroundColor: arch.color }]}>
                <Text style={styles.archTagLabel}>{arch.tag}</Text>
              </View>
              <Text style={styles.archName}>{arch.name}</Text>
            </View>
            <Text style={styles.archBio}>{arch.bio}</Text>
            <Text style={styles.affinity}>
              {Math.round(result.affinity)}% de afinidad
            </Text>
            <Text style={styles.coords}>
              Posesión ↔ Vertical: {format(result.x)} · Pragmático ↔ Dogmático: {format(result.y)}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button label={sharing ? 'Generando…' : 'Compartir'} onPress={onShare} disabled={sharing} testID="btn-share" />
          <View style={{ height: spacing.md }} />
          <Button label="Volver a empezar" onPress={handleRestart} variant="secondary" testID="btn-restart" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ---- Subcomponentes -----------------------------------------------------

const CompassView = ({ x, y }: { x: number; y: number }) => {
  // Mapear coordenadas del compass [-100, 100] a porcentajes del cuadrado.
  const xPct = ((x + 100) / 200) * 100;
  const yPct = 100 - ((y + 100) / 200) * 100;

  // Marcar arquetipos como pequeños puntos en el compass.
  return (
    <View style={styles.compassWrap} accessibilityLabel="Compass ideológico">
      <View style={styles.compassBg}>
        {/* Cuadrantes */}
        <View style={[styles.quad, styles.quadTL]} />
        <View style={[styles.quad, styles.quadTR]} />
        <View style={[styles.quad, styles.quadBL]} />
        <View style={[styles.quad, styles.quadBR]} />
        {/* Ejes */}
        <View style={styles.axisH} />
        <View style={styles.axisV} />

        {/* Arquetipos como dots */}
        {ARCHETYPES.map((a) => {
          const ax = ((a.x + 100) / 200) * 100;
          const ay = 100 - ((a.y + 100) / 200) * 100;
          return (
            <View
              key={a.id}
              style={[
                styles.archDot,
                {
                  left: `${ax}%`,
                  top: `${ay}%`,
                  backgroundColor: a.color,
                },
              ]}
            />
          );
        })}

        {/* Punto del usuario */}
        <View
          testID="user-dot"
          style={[
            styles.userDot,
            { left: `${xPct}%`, top: `${yPct}%` },
          ]}
        />
      </View>
      <View style={styles.labelsRow}>
        <Text style={styles.label}>Posesión</Text>
        <Text style={styles.label}>Vertical</Text>
      </View>
      <View style={styles.labelsColumn}>
        <Text style={styles.label}>Dogmático</Text>
        <Text style={styles.label}>Pragmático</Text>
      </View>
    </View>
  );
};

// ---- helpers ------------------------------------------------------------

function format(n: number): string {
  return `${n >= 0 ? '+' : ''}${Math.round(n)}`;
}

/**
 * Captura la `resurface` (la card de resultado) como PNG y devuelve el URI.
 * En web usa `html-to-image`; en nativo usa `react-native-view-shot`.
 *
 * Se hace lazy para no cargar las librerías en plataformas donde no se usan.
 */
async function capturePng(ref: React.RefObject<View | null>): Promise<string> {
  if (Platform.OS === 'web') {
    const node = ref.current as unknown as HTMLElement | null;
    if (!node) throw new Error('capturePng: ref no disponible');
    const htmlToImage = await import('html-to-image');
    const dataUrl = await htmlToImage.toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#0f172a',
    });
    return dataUrl;
  }
  // Nativo
  const ViewShot = await import('react-native-view-shot');
  const uri = await ViewShot.default.captureRef(ref, {
    format: 'png',
    quality: 0.95,
    result: 'tmpfile',
  });
  return uri;
}

// ---- styles -------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 16,
    lineHeight: 22,
  },
  shareSurface: {
    padding: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    gap: spacing.lg,
  },
  archCard: {
    borderWidth: 2,
  },
  eyebrow: {
    color: colors.muted,
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  archHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  archTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  archTagLabel: {
    color: '#052e16',
    fontWeight: '900',
    letterSpacing: 1,
  },
  archName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  archBio: {
    color: colors.textDim,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  affinity: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  coords: {
    color: colors.muted,
    fontSize: 12,
  },
  actions: {
    marginTop: spacing.md,
  },
  compassWrap: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    position: 'relative',
  },
  compassBg: {
    aspectRatio: 1,
    width: '100%',
    backgroundColor: colors.bgElev,
    borderRadius: radii.lg,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quad: {
    position: 'absolute',
    width: '50%',
    height: '50%',
    opacity: 0.18,
  },
  quadTL: { left: 0, top: 0, backgroundColor: '#3b82f6' },
  quadTR: { right: 0, top: 0, backgroundColor: '#a855f7' },
  quadBL: { left: 0, bottom: 0, backgroundColor: '#10b981' },
  quadBR: { right: 0, bottom: 0, backgroundColor: '#f59e0b' },
  axisH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: colors.border,
  },
  axisV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: colors.border,
  },
  archDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    marginTop: -4,
    opacity: 0.65,
  },
  userDot: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    marginTop: -9,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.text,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  labelsColumn: {
    position: 'absolute',
    top: spacing.lg,
    bottom: spacing.lg,
    left: 0,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
  },
});