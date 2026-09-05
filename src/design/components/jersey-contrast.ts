/**
 * MGC-1950 (PR #464 cleanup CTO) — algoritmo WCAG para derivar el color
 * del dorsal del JerseyPreview cuando el override NO incluye `dorsal`.
 *
 * Estrategia: para cada candidato (#0E1116 / #F4F1EB) calculamos el ratio
 * de contraste WCAG contra las 3 capas que se renderizan debajo del
 * dorsal (primary + secondary + accent) y elegimos el candidato con el
 * MEJOR worst-case ratio. Esto reemplaza el umbral roto `lum > 0.5` de
 * PR #464 sobre el `primary` solo (#808080 → #F4F1EB = 3.50:1, falla
 * WCAG AA; Boca #0A2A6B/#FBBF24 producía crema sobre amarillo = 1.48:1).
 */

export type JerseyLayers = {
  primary: string;
  secondary: string;
  accent: string;
};

/** Candidato dorsal: tinta oscura sobre jersey claro. */
export const DORSAL_INK = '#0E1116';
/** Candidato dorsal: tinta clara sobre jersey oscuro. */
export const DORSAL_CREAM = '#F4F1EB';
export const DORSAL_CANDIDATES = [DORSAL_INK, DORSAL_CREAM] as const;

/** WCAG 2.x relative luminance para un color hex `#RRGGBB`. */
export function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5; // fallback neutro si el formato no es hex de 6 chars
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/** WCAG 2.x contrast ratio entre dos colores hex `#RRGGBB`. */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Devuelve el peor ratio de contraste de `candidate` contra todas las
 * capas del jersey (primary/secondary/accent). Útil para reportar la
 * calidad del dorsal derivado en QA walks.
 */
export function worstContrastRatio(candidate: string, layers: JerseyLayers): number {
  const layerList = [layers.primary, layers.secondary, layers.accent];
  let worst = Infinity;
  for (const l of layerList) {
    const r = contrastRatio(candidate, l);
    if (r < worst) worst = r;
  }
  return worst;
}

/**
 * Elige el candidato (DORSAL_INK o DORSAL_CREAM) que maximiza el peor
 * ratio de contraste contra las 3 capas del jersey. Si ningún candidato
 * alcanza WCAG AA (≥ 4.5:1) — p.ej. Boca #0A2A6B/#FBBF24 donde yellow
 * y blue son complementarios —, devuelve el MEJOR disponible (degrada
 * con reporte explícito).
 */
export function deriveContrastDorsal(layers: JerseyLayers): {
  color: string;
  worstRatio: number;
} {
  // MGC-1950 — el tipo de `best` se anota explícitamente porque TS infiere
  // el literal del primer candidato ("#0E1116") y rechaza reasignaciones
  // con otros miembros del union.
  let best: (typeof DORSAL_CANDIDATES)[number] = DORSAL_CANDIDATES[0];
  let bestWorst = 0;
  for (const c of DORSAL_CANDIDATES) {
    const worst = worstContrastRatio(c, layers);
    if (worst > bestWorst) {
      bestWorst = worst;
      best = c;
    }
  }
  return { color: best, worstRatio: bestWorst };
}
