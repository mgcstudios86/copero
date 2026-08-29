// app/simulador-carrera/tu-jugador.tsx — MGC-209
//
// Wrapper file-based para `/simulador-carrera/tu-jugador` (pantalla 3/6:
// carta final con OVR inicial + potencial + picks).
import React, { Suspense, lazy } from 'react';

const TuJugadorScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/tu-jugador').then((m) => ({
    default: m.default,
  })),
);

export default function TuJugadorRoute() {
  return (
    <Suspense fallback={null}>
      <TuJugadorScreen />
    </Suspense>
  );
}
