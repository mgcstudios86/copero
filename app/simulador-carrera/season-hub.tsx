// app/simulador-carrera/season-hub.tsx — MGC-1649
//
// Wrapper file-based para `/simulador-carrera/season-hub` (pantalla 6/6
// nueva: hub de temporada con stats, próximo partido, fatiga, y acceso a
// la decisión semanal). Replica el patrón de `temporada.tsx` /
// `semanal.tsx`: archivo físico que registra la ruta en Expo Router +
// `lazy()` para preservar el code-split de pantalla.
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const SeasonHubScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/season-hub').then((m) => ({
    default: m.default,
  })),
);

export default function SeasonHubRoute() {
  return (
    <View style={{ flex: 1 }} testID="season-hub-screen">
      <Suspense fallback={null}>
        <SeasonHubScreen />
      </Suspense>
    </View>
  );
}