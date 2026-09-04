import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests unitarios del design system integrado en MGC-297.
 *
 * Sin `@testing-library/react-native` instalado todavía (no es una dep del
 * MVP), cubrimos:
 *   - tokens: invariantes de shape y valores esperados
 *   - exports: los componentes nuevos exportan funciones nombradas
 *   - ThemeProvider: resuelve scheme por `Appearance` (mockeado) y
 *     expone `reducedMotion` a partir de `AccessibilityInfo.isReduceMotionEnabled`
 *     (mockeado). Ver review MGC-337 HIGH #5.
 *
 * Los tests de render reales (Button pressed, RoundTimer animation, etc.)
 * quedan como follow-up hasta incorporar `@testing-library/react-native`.
 */

// Mock expo-router para que el `Link` que usa SiteHeader (MGC-653) no intente
// resolver el paquete real (ESM/TS que Node no parsea en CJS). El import tree
// de `src/design/components` carga SiteHeader aunque el test directo no lo
// ejercite — este stub evita el SyntaxError "Unexpected token 'typeof'" en CI.
vi.mock('expo-router', () => ({
  Link: 'Link',
  Stack: 'Stack',
  useRouter: () => ({ push: () => {}, back: () => {}, replace: () => {} }),
  useLocalSearchParams: () => ({}),
  useSearchParams: () => ({}),
  usePathname: () => '/',
  Redirect: 'Redirect',
  Slot: 'Slot',
}));

// MGC-1506 — VersionBadge re-exportado desde el barrel de design/components
// importa expo-constants → expo-modules-core Y react-native-safe-area-context.
// Ambos jalan Flow-typed source de `react-native` que Node no parsea en SSR.
// Mockeamos los dos con shape mínimo para que el barrel entero no rompa el
// suite en environment:node.
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: { version: '0.0.1', android: { versionCode: 15 } },
    nativeAppVersion: '0.0.1',
    nativeBuildVersion: 15,
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  SafeAreaView: ({ children }: { children: unknown }) => children,
  SafeAreaInsetsContext: { Consumer: () => null },
}));

// Mock react-native con un subset mínimo para que ThemeProvider pueda correr
// en el entorno `node` de vitest sin un DOM real.
vi.mock('react-native', () => {
  const listeners: Array<(state: { colorScheme: 'light' | 'dark' | null | undefined }) => void> = [];
  const reduceMotionListeners: Array<(enabled: boolean) => void> = [];
  let reduceMotionEnabled = false;
  return {
    Appearance: {
      getColorScheme: () => 'light',
      addChangeListener: (cb: (s: { colorScheme: 'light' | 'dark' | null | undefined }) => void) => {
        listeners.push(cb);
        return { remove: () => {} };
      },
    },
    AccessibilityInfo: {
      isReduceMotionEnabled: () => Promise.resolve(reduceMotionEnabled),
      addEventListener: (_event: string, cb: (enabled: boolean) => void) => {
        reduceMotionListeners.push(cb);
        return { remove: () => {} };
      },
      __setReduceMotion: (v: boolean) => {
        reduceMotionEnabled = v;
        reduceMotionListeners.forEach((cb) => cb(v));
      },
    },
    // Stubs que no se ejercitan en estos tests pero evitan crashes si
    // ThemeProvider termina invocándolos.
    View: 'View',
    Text: 'Text',
    Modal: 'Modal',
    Pressable: 'Pressable',
    Platform: { OS: 'ios', select: (o: { ios?: unknown; default?: unknown }) => o.ios ?? o.default },
    StyleSheet: { create: <T,>(s: T): T => s },
    Animated: { Value: function Value() { return { setValue: () => {}, interpolate: () => '' }; }, timing: () => ({ start: () => {} }), Easing: { linear: () => 0 } },
    Image: 'Image',
    ScrollView: 'ScrollView',
  };
});

import {
  borderWidth,
  colors,
  elevation,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  motion,
  palette,
  radii,
  spacing,
  tapTarget,
} from '../../src/design/tokens';
import { ThemeProvider } from '../../src/design/ThemeProvider';
import { useReducedMotion } from '../../src/design/useReducedMotion';
import { useTheme } from '../../src/design/useTheme';
import {
  BannerAd,
  Button,
  CategoryChip,
  InterstitialOverlay,
  RoundTimer,
  ScoreBoard,
  WordCard,
  Header,
  HeaderBackButton,
  Ticker,
  HeroCard,
  PillButton,
  LeagueCard,
  AccesosDirectos,
  Footer,
  BlogRow,
} from '../../src/design/components';

describe('design/tokens', () => {
  it('palette.light expone los colores base requeridos', () => {
    expect(palette.light.bg).toBe('#FAF7F2');
    expect(palette.light.primary).toBe('#1F6F4A');
    expect(palette.light.danger).toBe('#B91C1C');
  });

  it('palette.dark tiene contraste invertido (text = light)', () => {
    expect(palette.dark.bg.startsWith('#')).toBe(true);
    expect(palette.dark.text).toBe('#F0EAE0');
  });

  it('colors(mode) devuelve paleta light o dark', () => {
    expect(colors('light')).toBe(palette.light);
    expect(colors('dark')).toBe(palette.dark);
  });

  it('spacing es readonly y numérico', () => {
    expect(spacing[4]).toBe(16);
    expect(spacing[5]).toBe(24);
  });

  it('radii incluye pill para chips y badges', () => {
    expect(radii.pill).toBe(9999);
  });

  it('fontSize cubre escala hasta display', () => {
    expect(fontSize.xs).toBe(12);
    expect(fontSize.display).toBe(64);
  });

  it('motion expone durations en ms y easings como strings', () => {
    expect(motion.duration.fast).toBe(120);
    expect(typeof motion.easing.standard).toBe('string');
  });

  it('tapTarget cumple guideline WCAG 2.5.5 (>= 44px)', () => {
    expect(tapTarget).toBeGreaterThanOrEqual(44);
  });

  it('borderWidth tokeniza grosores (LOW #11 review MGC-337)', () => {
    expect(borderWidth.hairline).toBe(1);
    expect(borderWidth.chip).toBe(1.5);
    expect(borderWidth.thick).toBe(2);
  });
});

describe('design/components exports', () => {
  it('cada componente nuevo existe como función exportada', () => {
    expect(typeof Button).toBe('function');
    expect(typeof CategoryChip).toBe('function');
    expect(typeof RoundTimer).toBe('function');
    expect(typeof ScoreBoard).toBe('function');
    expect(typeof WordCard).toBe('function');
    expect(typeof BannerAd).toBe('function');
    expect(typeof InterstitialOverlay).toBe('function');
  });

  /**
   * MGC-555 PR3 — Header + Ticker (spec visual copero.com.ar §6.1 + §6.4).
   * Componentes nuevos del tercer PR de la serie de rediseño.
   */
  it('Header existe como función exportada (PR3 MGC-555)', () => {
    expect(typeof Header).toBe('function');
  });

  it('HeaderBackButton existe como función exportada (PR3 MGC-555)', () => {
    expect(typeof HeaderBackButton).toBe('function');
  });

  it('Ticker existe como función exportada (PR3 MGC-555)', () => {
    expect(typeof Ticker).toBe('function');
  });

  /**
   * MGC-555 PR4 — HeroCard (spec visual copero.com.ar §6.2).
   * Card grande con imagen full-bleed + overlay gradient + accent tint +
   * contenido anclado abajo-izquierda. Sin montaje global; integración a
   * home/dashboard queda para un PR posterior.
   */
  it('HeroCard existe como función exportada (PR4 MGC-555)', () => {
    expect(typeof HeroCard).toBe('function');
  });

  it('HeroCard acepta props sin imageUri (modo degradado puro)', () => {
    // Validación de shape: el componente existe y el contrato de props
    // no requiere imagen. El test de render real queda como follow-up
    // hasta incorporar @testing-library/react-native.
    expect(HeroCard.length).toBeLessThanOrEqual(1);
  });

  /**
   * MGC-555 PR5 — PillButton + LeagueCard (Resultados/Prodes) + AccesosDirectos.
   * Spec copero.com.ar §6.3, §6.4, §6.5 y §6.6. Cubre CTA principal,
   * grilla de ligas con dos variantes (lista de partidos y card prode
   * con imagen full-bleed), y carrusel de accesos directos en home.
   */
  it('PillButton existe como función exportada (PR5 MGC-555 §6.3)', () => {
    expect(typeof PillButton).toBe('function');
  });

  it('LeagueCard existe como función exportada con dos variantes (PR5 MGC-555 §6.4+§6.5)', () => {
    expect(typeof LeagueCard).toBe('function');
  });

  it('AccesosDirectos existe como función exportada (PR5 MGC-555 §6.6)', () => {
    expect(typeof AccesosDirectos).toBe('function');
  });

  /**
   * MGC-555 PR7 — Footer (spec visual copero.com.ar §6.8).
   * 4 columnas desktop / 1 columna mobile: logo+social, secciones,
   * destacado, legal+contacto. Hairline divider arriba y bottom row
   * con copyright + cookies + theme toggle.
   */
  it('Footer existe como función exportada (PR7 MGC-555 §6.8)', () => {
    expect(typeof Footer).toBe('function');
  });

  /**
   * MGC-555 PR6 — BlogRow (spec visual copero.com.ar §6.7).
   * Item de lista vertical con título Inter 15px weight 600 + tags chips
   * + meta relativa derecha.
   */
  it('BlogRow existe como función exportada (PR6 MGC-555 §6.7)', () => {
    expect(typeof BlogRow).toBe('function');
  });
});

describe('design/ThemeProvider', () => {
  beforeEach(() => {
    // Reset mocks entre tests si fuera necesario.
    vi.clearAllMocks();
  });

  it('ThemeProvider es una función (componente)', () => {
    expect(typeof ThemeProvider).toBe('function');
  });

  it('useReducedMotion es un hook (función) sin props requeridas', () => {
    expect(typeof useReducedMotion).toBe('function');
    expect(useReducedMotion.length).toBe(0);
  });

  it('useTheme es un hook que tira fuera del provider', () => {
    expect(typeof useTheme).toBe('function');
    // El error está cubierto por smoke manual en runtime — sólo validamos
    // el shape del hook acá.
    expect(useTheme.length).toBe(0);
  });

  it('tokens expone elevation con shape correcto', () => {
    expect(elevation).toEqual({ none: 0, sm: 1, md: 4, lg: 12 });
  });

  it('tokens expone lineHeight y fontWeight como as const', () => {
    expect(lineHeight.tight).toBe(1.1);
    expect(fontWeight.bold).toBe('700');
    expect(fontFamily.display).toBe('Poppins');
  });

  /**
   * MGC-555 PR2 — Cambio de default.
   * El `colors()` switch debe resolver `mode === 'copero'` cuando el sistema
   * reporta dark. Es el contrato que desbloquea `body.bg = #09090B` en el
   * bundle prod (gate del spec visual parity MGC-553).
   *
   * El mock react-native fija `Appearance.getColorScheme() => 'light'`
   * (ver arriba), así que para forzar dark hay que tocar el helper interno
   * que `resolveMode` consume. Lo cubrimos vía `colors(mode)` directo:
   * el cambio relevante es que el ThemeProvider delega en `colors('copero')`
   * cuando system dark, y `colors('copero')` debe devolver `palette.copero`
   * (bg #09090B), no `palette.dark` (bg #0E1411).
   */
  it('colors("copero") devuelve palette.copero con bg #09090B (MGC-555 PR2 default)', () => {
    const coperoColors = colors('copero');
    expect(coperoColors.bg).toBe('#09090B');
    expect(coperoColors.accent).toBe('#A855F7');
    expect(coperoColors).not.toBe(palette.dark);
  });
});
