// app/simulador-carrera/draft.tsx — MGC-209
//
// Wrapper file-based para `/simulador-carrera/draft`. La implementación
// vive en `@/features/simulador-carrera/screens/draft` y se carga lazy
// acá. Sin este archivo la navegación devuelve "Unmatched Route" (mismo
// rootcause que MGC-838 / MGC-841).
import React, { Suspense, lazy } from 'react';

const DraftScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/draft').then((m) => ({
    default: m.default,
  })),
);

export default function DraftRoute() {
  return (
    <Suspense fallback={null}>
      <DraftScreen />
    </Suspense>
  );
}
