// app/simulador-carrera/season-summary.tsx — MGC-487 (Step 6: cierre).
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const SeasonSummaryScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/season-summary').then((m) => ({
    default: m.default,
  })),
);

export default function SeasonSummaryRoute() {
  return (
    <View style={{ flex: 1 }} testID="season-summary-screen">
      <Suspense fallback={null}>
        <SeasonSummaryScreen />
      </Suspense>
    </View>
  );
}
