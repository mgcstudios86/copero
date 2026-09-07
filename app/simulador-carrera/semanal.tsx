// app/simulador-carrera/semanal.tsx — MGC-1657 (F2.3)
//
// Pantalla semanal V2. Reemplaza el flujo V1 (decide StrategyId) por el
// catálogo data-only `WEEKLY_BASE_OPTIONS`. Wired al reducer
// `weeklyChoice` que conecta con `applyWeeklyChoice` (motor puro F2.3).
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const SemanalScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/semanal').then((m) => ({
    default: m.default,
  })),
);

export default function SemanalRoute() {
  return (
    <View style={{ flex: 1 }} testID="semanal-screen-wrapper">
      <Suspense fallback={null}>
        <SemanalScreen />
      </Suspense>
    </View>
  );
}
