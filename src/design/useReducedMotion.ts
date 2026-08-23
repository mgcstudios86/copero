import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';

/**
 * Devuelve true si el usuario activó Reduce Motion en ajustes del sistema.
 * Usar para saltarse animaciones y aplicar estados finales directamente.
 */
export function useReducedMotion(): boolean {
  return useContext(ThemeContext).reducedMotion;
}
