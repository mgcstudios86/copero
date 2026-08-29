// app/simulador-carrera/fin-carrera.tsx — MGC-209
//
// Wrapper file-based para `/simulador-carrera/fin-carrera` (pantalla 6/6:
// resumen y veredicto al retiro).
import React, { Suspense, lazy } from 'react';

const FinCarreraScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/fin-carrera').then((m) => ({
    default: m.default,
  })),
);

export default function FinCarreraRoute() {
  return (
    <Suspense fallback={null}>
      <FinCarreraScreen />
    </Suspense>
  );
}
