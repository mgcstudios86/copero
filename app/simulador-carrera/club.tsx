// app/simulador-carrera/club.tsx — MGC-209
//
// Wrapper file-based para `/simulador-carrera/club` (pantalla 4/6:
// selector de club post-draft con arquetipo / reputación / minutos).
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const SeleccionClubScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/club').then((m) => ({
    default: m.default,
  })),
);

export default function SeleccionClubRoute() {
  return (
    <View style={{ flex: 1 }} testID="club-screen">
      <Suspense fallback={null}>
        <SeleccionClubScreen />
      </Suspense>
    </View>
  );
}
