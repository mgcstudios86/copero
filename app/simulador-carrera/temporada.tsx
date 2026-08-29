// app/simulador-carrera/temporada.tsx — MGC-209
//
// Wrapper file-based para `/simulador-carrera/temporada` (pantalla 5/6:
// dashboard temporal con timeline de temporadas).
import React, { Suspense, lazy } from 'react';

const TemporadaScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/temporada').then((m) => ({
    default: m.default,
  })),
);

export default function TemporadaRoute() {
  return (
    <Suspense fallback={null}>
      <TemporadaScreen />
    </Suspense>
  );
}
