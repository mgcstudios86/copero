import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * MGC-601 / MGC-487.4 — TR1 estructural del modal de celebración.
 *
 * El modal usa la API Animated de react-native con `useNativeDriver: true`,
 * lo que hace prohibitivamente caro mockearla en jsdom (necesita un
 * bridge native). Para evitar flakiness seguimos el patrón del resto
 * de screens (transfer-offers.test.ts, social-events.test.ts):
 * validar la estructura del archivo en lugar de renderizar el árbol.
 *
 * Cubre:
 *  - contrato de props (champion / visible / onClose / onNewSeason).
 *  - testIDs estables para UIAutomator (ZY22G728HN, MGC-833).
 *  - accesibilidad del modal (role=alert, live region en el campeón).
 *  - respeto a prefers-reduced-motion (MGC-337 LOW #5).
 *  - trofeo animado + CTA "Nueva temporada".
 */
describe('CelebrationModal — estructura (MGC-601 / MGC-487.4)', () => {
  const src = readFileSync(
    resolve(__dirname, 'CelebrationModal.tsx'),
    'utf8',
  );

  it('exporta CelebrationModal y default', () => {
    expect(src).toContain('export function CelebrationModal');
    expect(src).toContain('export default CelebrationModal');
  });

  it('acepta props champion, visible, onClose, onNewSeason', () => {
    expect(src).toMatch(/champion:\s*string\s*\|\s*null/);
    expect(src).toMatch(/visible:\s*boolean/);
    expect(src).toMatch(/onClose:\s*\(\)\s*=>/);
    expect(src).toMatch(/onNewSeason:\s*\(\)\s*=>/);
  });

  it('no renderiza nada si !visible o !champion (early return)', () => {
    expect(src).toMatch(/if\s*\(!visible\s*\|\|\s*!champion\)\s*return\s*null/);
  });

  it('declara Modal accesible con role=alert y testID estable', () => {
    expect(src).toContain('testID="celebration-modal"');
    // Reanimated Animated.View contenedor con role=alert via
    // accessibilityRole en el Modal wrapper no aplica — el wrapper
    // es Pressable con role=button (backdrop). El header del modal
    // declara role=header para que TalkBack anuncie la sección.
    expect(src).toContain('accessibilityRole="header"');
  });

  it('expone el nombre del campeón con live region polite', () => {
    expect(src).toContain('accessibilityLiveRegion="polite"');
    expect(src).toContain('testID="celebration-champion-name"');
    expect(src).toMatch(/accessibilityLabel=\{`Campe[oó]n:\s*\$\{champion\}`\}/);
  });

  it('expone trofeo animado y confeti con testIDs estables', () => {
    expect(src).toContain('testID="celebration-trophy"');
    expect(src).toContain('testID="celebration-confetti"');
  });

  it('CTA principal "Nueva temporada" navega via onNewSeason', () => {
    expect(src).toContain('label="Nueva temporada"');
    expect(src).toContain('testID="celebration-btn-new-season"');
    expect(src).toMatch(
      /<Button[\s\S]*?label="Nueva temporada"[\s\S]*?onPress=\{onNewSeason\}/,
    );
  });

  it('CTA secundaria "Cerrar" llama onClose', () => {
    expect(src).toContain('label="Cerrar"');
    expect(src).toContain('testID="celebration-btn-close"');
    expect(src).toMatch(/onPress=\{onClose\}/);
  });

  it('respeta prefers-reduced-motion (MGC-337 LOW #5)', () => {
    // Lee el contexto desde useTheme y branchea el comportamiento.
    expect(src).toMatch(/reducedMotion/);
    // El loop de pulse no arranca si reduced-motion está activo.
    expect(src).toMatch(/if\s*\(\s*reducedMotion\s*\)\s*return/);
  });

  it('permite apagar confeti via enableConfetti prop (default true)', () => {
    expect(src).toMatch(/enableConfetti\?:\s*boolean/);
    expect(src).toMatch(/enableConfetti\s*=\s*true/);
  });

  it('la paleta de confeti es determinista (semillada por index)', () => {
    // Sin `Math.random()` en buildConfetti — los snapshots visuales
    // deben ser estables entre cargas.
    const confettiBlock = src.slice(
      src.indexOf('function buildConfetti'),
      src.indexOf('return out;') + 'return out;'.length,
    );
    expect(confettiBlock).not.toContain('Math.random');
  });

  it('usa Animated nativo (no Reanimated) para mantener consistencia con Ticker/RoundTimer', () => {
    expect(src).toMatch(/from 'react-native'[\s\S]*Animated/);
    expect(src).not.toContain("from 'react-native-reanimated'");
  });
});

/**
 * MGC-601 — contrato de wiring en playoff.tsx.
 *
 * Verifica que el modal está montado al final del árbol del screen
 * y que el efecto auto-show dispara cuando `champion` deja de ser
 * `null`.
 */
describe('playoff.tsx — wiring del modal (MGC-601)', () => {
  const src = readFileSync(
    resolve(__dirname, 'playoff.tsx'),
    'utf8',
  );

  it('importa CelebrationModal del path relativo correcto', () => {
    expect(src).toContain(
      "import { CelebrationModal } from './CelebrationModal'",
    );
  });

  it('declara showCelebration + celebrationDismissed', () => {
    expect(src).toContain('const [showCelebration, setShowCelebration] = useState(false)');
    expect(src).toContain('const [celebrationDismissed, setCelebrationDismissed] = useState(false)');
  });

  it('auto-show cuando champion se resuelve (sin re-mostrar tras dismiss)', () => {
    expect(src).toMatch(
      /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(\s*champion\s*&&\s*!celebrationDismissed\s*\)/,
    );
    expect(src).toContain('setShowCelebration(true)');
  });

  it('pasa onClose y onNewSeason al modal', () => {
    const modalBlock = src.slice(src.indexOf('<CelebrationModal'));
    expect(modalBlock).toMatch(/onClose=\{onCelebrationClose\}/);
    expect(modalBlock).toMatch(/onNewSeason=\{onCelebrationNewSeason\}/);
    expect(modalBlock).toMatch(/champion=\{champion\}/);
    expect(modalBlock).toMatch(/season=\{profile\?\.season\s*\?\?\s*1\}/);
  });

  it('los handlers setean celebrationDismissed para no re-mostrar', () => {
    expect(src).toContain('setCelebrationDismissed(true)');
  });
});
