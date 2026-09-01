// app/simulador-carrera/compass.tsx — MGC-1210
//
// Wrapper file-based para `/simulador-carrera/compass`. Resuelve el "Unmatched
// Route" del deep link `copero://simulador-carrera/compass` (APK MGC-1194
// PR-303 SHA 6629ccc3). Mismo patrón que `categoria.tsx` — chunk async desde
// `@/features/game/screens/compass` (MGC-782 code-split).
import React, { Suspense, lazy } from 'react';

const CompassScreen = lazy(() =>
  import('@/features/game/screens/compass').then((m) => ({
    default: m.default,
  })),
);

export default function CompassRoute() {
  return (
    <Suspense fallback={null}>
      <CompassScreen />
    </Suspense>
  );
}
