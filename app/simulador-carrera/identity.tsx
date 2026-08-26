// app/simulador-carrera/identity.tsx — MGC-841
//
// Wrapper file-based route para `/simulador-carrera/identity`. Misma rationale
// que `dashboard.tsx`: la implementación vive en features/ (MGC-771 code-split)
// y se carga lazy acá. Sin este archivo la navegación al formulario de
// identidad devuelve "Unmatched Route" (mismo rootcause que MGC-838).
import React, { Suspense, lazy } from 'react';

const IdentityScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/identity').then((m) => ({
    default: m.default,
  })),
);

export default function IdentityRoute() {
  return (
    <Suspense fallback={null}>
      <IdentityScreen />
    </Suspense>
  );
}