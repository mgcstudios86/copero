// app/simulador-carrera/modo-copero/calendario.tsx — MGC-490
//
// Route wrapper para `/simulador-carrera/modo-copero/calendario` (pantalla 2/3
// del flow modo-copero). Pantalla real vive en
// `@/features/simulador-carrera/screens/modo-copero/calendario-copa`.
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';
import { VersionBadge } from '@/design/components/VersionBadge';

const CalendarioCopaScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/modo-copero/calendario-copa').then((m) => ({
    default: m.default,
  })),
);

export default function ModoCoperoCalendarioRoute() {
  return (
    <View style={{ flex: 1 }} testID="modo-copero-calendario-route">
      <Suspense fallback={null}>
        <CalendarioCopaScreen />
      </Suspense>
      <VersionBadge variant="corner" testID="modo-copero-calendario-version-badge" />
    </View>
  );
}
