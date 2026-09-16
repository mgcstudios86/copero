// app/simulador-carrera/alineacion.tsx — MGC-245
//
// Wrapper file-based route para `/simulador-carrera/alineacion`. La
// implementación vive en `src/features/simulador-carrera/screens/alineacion.tsx`
// (mismo patrón que `dashboard.tsx` MGC-841 + `match.tsx`) y se carga lazy
// acá para preservar el chunk asincrónico dedicado que Metro emite on-demand.
// Sin este archivo Expo Router no resuelve `router.push('/simulador-carrera/alineacion')`
// y devuelve `copero:///` → "Unmatched Route" (mismo bug que MGC-841 documentó
// para `dashboard`).
import React, { Suspense, lazy } from 'react';

const AlineacionScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/alineacion').then((m) => ({
    default: m.default,
  })),
);

export default function AlineacionRoute() {
  return (
    <Suspense fallback={null}>
      <AlineacionScreen />
    </Suspense>
  );
}