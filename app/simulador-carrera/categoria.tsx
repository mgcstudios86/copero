// app/simulador-carrera/categoria.tsx — MGC-1210
//
// Wrapper file-based para `/simulador-carrera/categoria`. Resuelve el
// "Unmatched Route" del deep link `copero://simulador-carrera/categoria`
// (APK MGC-1194 PR-303 SHA 6629ccc3, evidencia `evidence/MGC-1204/09-categoria.png`).
//
// La implementación vive en `src/features/game/screens/categoria.tsx` (MGC-782
// code-split: chunk asincrónico dedicado de ~14 KB gz on-demand). Sin este
// archivo, Expo Router no resuelve la ruta y devuelve "Unmatched Route" — mismo
// rootcause que MGC-836 / MGC-841 (ticket original del patrón wrapper).
//
// Nota: el screen interno navega con `router.replace('/ronda')` (root, no
// `/simulador-carrera/ronda`); ambos paths resuelven la misma pantalla porque
// los wrappers bajo `simulador-carrera/` re-exportan los mismos chunks.
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const CategoriaScreen = lazy(() =>
  import('@/features/game/screens/categoria').then((m) => ({
    default: m.default,
  })),
);

export default function CategoriaRoute() {
  return (
    <View style={{ flex: 1 }} testID="categoria-screen">
      <Suspense fallback={null}>
        <CategoriaScreen />
      </Suspense>
    </View>
  );
}
