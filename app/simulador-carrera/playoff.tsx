// app/simulador-carrera/playoff.tsx — MGC-487 (Step 5: playoffs bracket).
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const PlayoffScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/playoff').then((m) => ({
    default: m.default,
  })),
);

export default function PlayoffRoute() {
  return (
    <View style={{ flex: 1 }} testID="playoff-screen">
      <Suspense fallback={null}>
        <PlayoffScreen />
      </Suspense>
    </View>
  );
}
