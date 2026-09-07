// app/simulador-carrera/match.tsx — MGC-1650 (WF4 partido).
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const MatchScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/match').then((m) => ({
    default: m.default,
  })),
);

export default function MatchRoute() {
  return (
    <View style={{ flex: 1 }} testID="match-screen-wrapper">
      <Suspense fallback={null}>
        <MatchScreen />
      </Suspense>
    </View>
  );
}