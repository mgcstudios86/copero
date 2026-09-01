// app/simulador-carrera/ronda.tsx — MGC-1210
//
// Wrapper file-based para `/simulador-carrera/ronda`. Resuelve el "Unmatched
// Route" del deep link `copero://simulador-carrera/ronda` (APK MGC-1194 PR-303
// SHA 6629ccc3). Mismo patrón que `categoria.tsx` — chunk async desde
// `@/features/game/screens/ronda` (MGC-782 code-split).
import React, { Suspense, lazy } from 'react';

const RondaScreen = lazy(() =>
  import('@/features/game/screens/ronda').then((m) => ({
    default: m.default,
  })),
);

export default function RondaRoute() {
  return (
    <Suspense fallback={null}>
      <RondaScreen />
    </Suspense>
  );
}
