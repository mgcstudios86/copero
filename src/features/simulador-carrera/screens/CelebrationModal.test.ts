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

/**
 * MGC-614 — fix de navegación de "Nueva temporada" en CelebrationModal.
 *
 * Bug: setShowCelebration(false) ANTES de router.push(...) desmonta el
 * Modal nativo de react-native en vuelo y descarta el push. Resultado:
 * el botón vuelve a playoff en lugar de ir a season-summary.
 *
 * Solución aplicada (opción 1 del fix sugerido): reordenar el handler
 * para que onCloseSeason() (que ejecuta router.push) corra ANTES de
 * setShowCelebration(false). celebrationDismissed se setea también
 * antes para evitar el re-show mid-transition.
 *
 * Patrón de test: estructural (lee el source y verifica el orden de
 * las llamadas dentro de onCelebrationNewSeason). Evita mockear
 * expo-router / Animated native.
 */
describe('playoff.tsx — fix navegación Nueva temporada (MGC-614)', () => {
  const src = readFileSync(
    resolve(__dirname, 'playoff.tsx'),
    'utf8',
  );

  function extractHandlerBody(): string {
    const marker = 'const onCelebrationNewSeason = useCallback(';
    const start = src.indexOf(marker);
    if (start < 0) throw new Error('handler onCelebrationNewSeason no encontrado');
    // Tomamos desde el `=>` hasta el `}, [onCloseSeason]);` que cierra.
    const arrowIdx = src.indexOf('=>', start);
    const closeIdx = src.indexOf('}, [onCloseSeason]);', arrowIdx);
    if (closeIdx < 0) throw new Error('cierre del useCallback no encontrado');
    return src.slice(arrowIdx, closeIdx);
  }

  it('reordena handler: navega ANTES de desmontar el modal', () => {
    const body = extractHandlerBody();
    const idxDismissed = body.indexOf('setCelebrationDismissed(true)');
    const idxCloseSeason = body.indexOf('onCloseSeason()');
    const idxHideModal = body.indexOf('setShowCelebration(false)');

    // Sanity: las tres llamadas están presentes.
    expect(idxDismissed).toBeGreaterThan(-1);
    expect(idxCloseSeason).toBeGreaterThan(-1);
    expect(idxHideModal).toBeGreaterThan(-1);

    // El orden es lo crítico: dismissed → navigate → hide modal.
    // Si el hide modal va primero, el Modal nativo se desmonta en
    // vuelo y descarta el push (ver root cause en MGC-614).
    expect(idxDismissed).toBeLessThan(idxCloseSeason);
    expect(idxCloseSeason).toBeLessThan(idxHideModal);
  });

  it('mantiene celebrationDismissed=true antes de la navegación', () => {
    // Sin esto, el useEffect([champion, celebrationDismissed]) puede
    // re-disparar setShowCelebration(true) mientras el push está en
    // vuelo y reabrir el modal sobre la pantalla nueva.
    const body = extractHandlerBody();
    const idxDismissed = body.indexOf('setCelebrationDismissed(true)');
    const idxCloseSeason = body.indexOf('onCloseSeason()');
    expect(idxDismissed).toBeLessThan(idxCloseSeason);
  });

  it('onCloseSeason ejecuta router.push al season-summary', () => {
    // El handler llama a onCloseSeason (que internamente hace
    // router.push('/simulador-carrera/season-summary')). Verificamos
    // que onCloseSeason sigue siendo la fuente de la navegación.
    const body = extractHandlerBody();
    expect(body).toContain('onCloseSeason()');
  });

  it('onCloseSeason navega a /simulador-carrera/season-summary (mockeable)', () => {
    // El handler onCloseSeason es la pieza mockeable: en un test de
    // integración se reemplaza por un jest.fn() y se verifica que el
    // botón "Nueva temporada" lo invoca. Este test estructural sólo
    // asegura que el path es el correcto.
    const closeSeasonMatch = src.match(
      /const onCloseSeason\s*=\s*useCallback\(\s*\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[router\]\s*\)/,
    );
    expect(closeSeasonMatch).not.toBeNull();
    expect(closeSeasonMatch![1]).toContain(
      "router.push('/simulador-carrera/season-summary')",
    );
  });

  it('onCelebrationClose NO navega — sólo dismissa el modal', () => {
    // El handler de backdrop/Cerrar debe seguir sin navegar para
    // preservar el workaround documentado en MGC-614.
    const closeMatch = src.match(
      /const onCelebrationClose\s*=\s*useCallback\(\s*\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[\]\s*\)/,
    );
    expect(closeMatch).not.toBeNull();
    expect(closeMatch![1]).not.toContain('router.push');
    expect(closeMatch![1]).not.toContain('onCloseSeason');
    expect(closeMatch![1]).toContain('setShowCelebration(false)');
    expect(closeMatch![1]).toContain('setCelebrationDismissed(true)');
  });
});
