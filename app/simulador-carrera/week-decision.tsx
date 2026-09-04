// app/simulador-carrera/week-decision.tsx — MGC-1649
//
// Wrapper file-based para `/simulador-carrera/week-decision` (placeholder
// F1 con 4 opciones fijas; F2 lo reemplaza por el árbol posicional).
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';
import { VersionBadge } from '@/design/components/VersionBadge';

const WeekDecisionScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/week-decision').then((m) => ({
    default: m.default,
  })),
);

export default function WeekDecisionRoute() {
  return (
    <View style={{ flex: 1 }} testID="week-decision-screen">
      <Suspense fallback={null}>
        <WeekDecisionScreen />
      </Suspense>
      <VersionBadge variant="corner" testID="week-decision-version-badge" />
    </View>
  );
}