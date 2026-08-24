import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Appearance, ColorSchemeName } from 'react-native';
import {
  ColorScale,
  ThemeMode,
  borderWidth,
  colors,
  elevation,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  motion,
  radii,
  spacing,
  tapTarget,
} from './tokens';

export type ResolvedTheme = {
  mode: ThemeMode;
  colors: ColorScale;
  spacing: typeof spacing;
  radii: typeof radii;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  fontWeight: typeof fontWeight;
  fontFamily: typeof fontFamily;
  motion: typeof motion;
  elevation: typeof elevation;
  tapTarget: number;
  borderWidth: typeof borderWidth;
  reducedMotion: boolean;
};

/**
 * API pública del contexto.
 * `setMode` está oculto hasta que exista una UI de override (settings screen).
 * Mientras tanto, el theme sigue el `Appearance` del sistema operativo y la
 * preferencia guardada (`initialPreference`), sin permitir mutación por
 * consumidores. Ver §LOW #10 del review MGC-337.
 */
export type ThemeContextValue = ResolvedTheme & {
  preference: ThemeMode | 'system';
};

const defaultValue: ThemeContextValue = {
  mode: 'light',
  colors: colors('light'),
  spacing,
  radii,
  fontSize,
  lineHeight,
  fontWeight,
  fontFamily,
  motion,
  elevation,
  tapTarget,
  borderWidth,
  reducedMotion: false,
  preference: 'system',
};

export const ThemeContext = createContext<ThemeContextValue>(defaultValue);

/**
 * Resuelve el `ThemeMode` activo a partir de la preferencia del usuario y
 * el `Appearance` del SO.
 *
 * MGC-555 PR2 — Cambio de default:
 *   - `preference: 'system'` + system dark → `'copero'` (alineado con la
 *     identidad visual `copero.com.ar`/`design/copero-ar-visual-spec.md` §3.1).
 *     Antes resolvía a `'dark'` (identidad forest propia), que es la que
 *     renderizaba `body.bg = #0E1411` en el bundle prod.
 *   - `'light'` se mantiene para system light.
 *   - Preferencia explícita (`'light' | 'dark' | 'copero'`) gana siempre —
 *     la pantalla de settings puede forzar `dark` legacy si fuera necesario.
 *
 * El modo `'dark'` propio **sigue disponible** vía `setMode('dark')` y
 * desde `palette.dark` (contrato C1/C2 intacto). Solo cambia el default
 * automático cuando el usuario no expresó preferencia.
 */
const resolveMode = (
  preference: ThemeMode | 'system',
  system: ColorSchemeName | null,
): ThemeMode => {
  if (preference === 'system') {
    return system === 'dark' ? 'copero' : 'light';
  }
  return preference;
};

type ThemeProviderProps = {
  children: React.ReactNode;
  initialPreference?: ThemeMode | 'system';
};

export function ThemeProvider({ children, initialPreference = 'system' }: ThemeProviderProps) {
  const [preference, setPreference] = useState<ThemeMode | 'system'>(initialPreference);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName | null>(
    Appearance.getColorScheme() ?? null,
  );
  const [reducedMotion, setReducedMotion] = useState(false);

  // Mantenido internamente; no se expone hasta tener UI de override.
  const _setMode = useCallback((next: ThemeMode | 'system') => {
    setPreference(next);
  }, []);
  // Referenciar para no perder la rama hasta tener UI.
  void _setMode;

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReducedMotion(enabled);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const mode = resolveMode(preference, systemScheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: colors(mode),
      spacing,
      radii,
      fontSize,
      lineHeight,
      fontWeight,
      fontFamily,
      motion,
      elevation,
      tapTarget,
      borderWidth,
      reducedMotion,
      preference,
    }),
    [mode, reducedMotion, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
