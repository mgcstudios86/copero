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

  /**
   * MGC-629 — fix del backdrop que se llevaba el tap del Button.
   *
   * Bug: el Pressable del backdrop era padre del card (Animated.View)
   * que contiene los Button. En React Native, el Pressable padre
   * captura el touch antes que el hijo y, aunque el hijo registre un
   * onPress en su Pressable interno, el evento puede ser consumido por
   * el padre antes de propagarse. Resultado: tocar "Nueva temporada"
   * disparaba onClose (el backdrop) en lugar de onNewSeason.
   *
   * Fix: el backdrop pasa a ser un Pressable hermano del card (no
   * padre). Se monta como `StyleSheet.absoluteFill` por detrás y el
   * contenedor del card declara `pointerEvents="box-none"` para que
   * sólo el área fuera del card reciba el dismiss-tap.
   *
   * Test estructural: el Pressable del backdrop NO debe envolver el
   * `celebration-card` y debe usar `StyleSheet.absoluteFill`.
   */
  it('MGC-629: backdrop es Pressable hermano, NO padre del card', () => {
    // El Pressable del backdrop usa absoluteFill (sibling pattern).
    expect(src).toMatch(/<Pressable[\s\S]*?style=\{StyleSheet\.absoluteFill\}/);
    // El Pressable del backdrop lleva testID propio, separado del card.
    expect(src).toContain('testID="celebration-backdrop"');
    // El contenedor del card tiene pointerEvents="box-none".
    expect(src).toMatch(/<View[\s\S]*?pointerEvents="box-none"/);
    // Sanity: el Pressable del backdrop NO abre un Animated.View como
    // hijo directo (eso sería el patrón bugueado).
    const backdropMatch = src.match(
      /<Pressable[\s\S]*?testID="celebration-backdrop"[\s\S]*?\/>/,
    );
    expect(backdropMatch).not.toBeNull();
    expect(backdropMatch![0]).not.toContain('<Animated.View');
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
 * MGC-614 / MGC-629 — fix de navegación de "Nueva temporada" en
 * CelebrationModal.
 *
 * Bug raíz confirmado por QA walk MGC-630 (SHA d3f18ef): el Modal
 * de RN sobre Android monta un DialogFragment nativo que retiene la
 * transición del stack hasta que se dismisse. Cualquier
 * `setShowCelebration(false)` en el batch del onPress (sync,
 * microtask vía InteractionManager, o macrotask vía setTimeout)
 * dismissa el DialogFragment ANTES que el router.push commitee el
 * stack swap, y expo-router aborta la navegación silenciosamente.
 *
 * Iteraciones:
 *   - iter1 (ab860c5): reorder push → setShow(false). FAIL — mismo batch.
 *   - iter2 (f44b94e): diferir setShow(false) con InteractionManager.
 *     FAIL — sin animaciones JS en flight, runAfterInteractions
 *     dispara en el próximo microtask que sigue corriendo en el
 *     mismo commit del press que ya despachó el push.
 *   - iter3 (d3f18ef): backdrop hermano + pointerEvents box-none.
 *     PASS estructural, pero NO atacó la race de navigation.
 *   - iter4 (esta fix): NO flipar visible=false en el handler. El
 *     Modal se desmonta solo cuando playoff unmounts como parte
 *     del navigation transition de expo-router. `router.replace` (no
 *     `push`) evita acumular un back-stack con playoff tapado por
 *     el modal. `celebrationDismissed=true` se setea sincrónicamente
 *     para que el useEffect([champion, dismissed]) no reabra el modal
 *     si el bracket sigue resuelto al volver.
 *
 * Patrón de test: estructural (lee el source y verifica la forma del
 * handler). Evita mockear expo-router / Animated native.
 */
describe('playoff.tsx — fix navegación Nueva temporada (MGC-614 / MGC-629 iter4)', () => {
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

  it('NO importa InteractionManager (iter4 — Modal unmounts con playoff)', () => {
    // iter4 abandona el diferido InteractionManager (que disparaba en
    // el mismo commit que el push). El Modal se desmonta con playoff
    // durante el screen swap, no antes. Si InteractionManager vuelve
    // a aparecer es regresión.
    expect(src).not.toMatch(
      /import\s*\{[^}]*InteractionManager[^}]*\}\s*from\s*'react-native'/,
    );
    const body = extractHandlerBody();
    expect(body).not.toContain('InteractionManager.runAfterInteractions');
    expect(body).not.toContain('InteractionManager');
  });

  it('handler NO llama setShowCelebration(false) — Modal unmounts con playoff', () => {
    // Cualquier setShowCelebration(false) en el batch del press
    // dismissea el DialogFragment y cancela el push. iter4 lo omite
    // por completo en este handler.
    const body = extractHandlerBody();
    expect(body).not.toContain('setShowCelebration(false)');
    expect(body).not.toContain('setShowCelebration(');
  });

  it('handler setea celebrationDismissed=true ANTES de navegar', () => {
    // Sin esto, el useEffect([champion, celebrationDismissed]) puede
    // re-disparar setShowCelebration(true) mientras el replace está en
    // vuelo y reabrir el modal sobre la pantalla nueva.
    const body = extractHandlerBody();
    const idxDismissed = body.indexOf('setCelebrationDismissed(true)');
    const idxCloseSeason = body.indexOf('onCloseSeason()');
    expect(idxDismissed).toBeGreaterThan(-1);
    expect(idxCloseSeason).toBeGreaterThan(-1);
    expect(idxDismissed).toBeLessThan(idxCloseSeason);
  });

  it('handler llama onCloseSeason() después de setear dismissed', () => {
    const body = extractHandlerBody();
    expect(body).toContain('onCloseSeason()');
  });

  it('onCloseSeason usa router.replace (no push) para swap atómico', () => {
    // router.replace evita acumular un back-stack con playoff tapado
    // por el modal, y la transición es más atómica que push sobre
    // un stack con un DialogFragment encima.
    const closeSeasonMatch = src.match(
      /const onCloseSeason\s*=\s*useCallback\(\s*\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[router\]\s*\)/,
    );
    expect(closeSeasonMatch).not.toBeNull();
    expect(closeSeasonMatch![1]).toContain(
      "router.replace('/simulador-carrera/season-summary')",
    );
    // No debe seguir navegando con router.push — sería regresión a iter1.
    expect(closeSeasonMatch![1]).not.toContain('router.push');
  });

  it('onCelebrationClose NO navega — sólo dismissa el modal', () => {
    // El handler de backdrop/Cerrar debe seguir sin navegar para
    // preservar el contrato original (cancelar sin avanzar).
    const closeMatch = src.match(
      /const onCelebrationClose\s*=\s*useCallback\(\s*\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[\]\s*\)/,
    );
    expect(closeMatch).not.toBeNull();
    expect(closeMatch![1]).not.toContain('router.push');
    expect(closeMatch![1]).not.toContain('router.replace');
    expect(closeMatch![1]).not.toContain('onCloseSeason');
    expect(closeMatch![1]).toContain('setShowCelebration(false)');
    expect(closeMatch![1]).toContain('setCelebrationDismissed(true)');
  });
});
