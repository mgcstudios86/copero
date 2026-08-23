import { useContext } from 'react';
import { ThemeContext, ThemeContextValue } from './ThemeProvider';

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  }
  return value;
}
