import type { CareerStage } from '@/types/career';

/**
 * MGC-42.C — Helper compartido de routing de resume.
 *
 * El CTO (assessment MGC-43) marcó como duplicado cosmético la copia de
 * `resumeRouteForStage` que vivía tanto en `app/index.tsx` (CTA "Continuar
 * carrera" del home) como en `app/simulador-carrera/index.tsx` (red de
 * seguridad del segmento). La solución es extraer acá el mapa canónico
 * `CareerStage → ruta de resume` para que ambas entry points importen la
 * misma fuente. Si en el futuro se agrega un nuevo stage o se renombra
 * una ruta, se toca un solo archivo.
 *
 * Antes (MGC-251): mapa duplicado en `app/index.tsx:42` y
 * `app/simulador-carrera/index.tsx:31`. Comentario explícito en cada
 * copia justificaba la duplicación ("no exportar helper desde el screen
 * acoplaría la lógica del home al segmento") — pero la duplicación
 * quedaba propensa a drift entre los dos call sites.
 */
export function resumeRouteForStage(stage: CareerStage): string {
  switch (stage) {
    case 'identity':
      return '/simulador-carrera/identity';
    case 'dashboard':
    case 'academy':
    case 'clubStart':
      return '/simulador-carrera/dashboard';
    case 'draft':
      return '/simulador-carrera/draft';
    case 'club':
      return '/simulador-carrera/tu-jugador';
    case 'season':
      return '/simulador-carrera/temporada';
    case 'retirement':
      return '/simulador-carrera/fin-carrera';
    default:
      return '/simulador-carrera/dashboard';
  }
}