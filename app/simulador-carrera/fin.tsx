// app/simulador-carrera/fin.tsx — MGC-1210
//
// Wrapper file-based para `/simulador-carrera/fin`. Resuelve el "Unmatched
// Route" del deep link `copero://simulador-carrera/fin` (APK MGC-1194 PR-303
// SHA 6629ccc3). Mismo patrón que `categoria.tsx` — chunk async desde
// `@/features/game/screens/fin` (MGC-782 code-split).
//
// NO confundir con `fin-carrera.tsx` (MGC-209): `fin-carrera` es el resumen
// de la trayectoria completa del jugador (retiro, vitrina de títulos,
// legado). `fin` es la pantalla que cierra una ronda del juego de palabras
// (score, mejor racha, CTA "Volver a Jugar"). Ambas coexisten en el árbol
// porque apuntan a pantallas distintas del producto.
import React, { Suspense, lazy } from 'react';

const FinScreen = lazy(() =>
  import('@/features/game/screens/fin').then((m) => ({
    default: m.default,
  })),
);

export default function FinRoute() {
  return (
    <Suspense fallback={null}>
      <FinScreen />
    </Suspense>
  );
}
