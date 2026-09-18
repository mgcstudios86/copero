// app/simulador-carrera/modo-copero/celebracion.tsx — MGC-490
//
// Route wrapper para `/simulador-carrera/modo-copero/celebracion` (pantalla 3/3
// del flow modo-copero). Pantalla real vive en
// `@/features/simulador-carrera/screens/modo-copero/celebracion`.
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';
import { VersionBadge } from '@/design/components/VersionBadge';

const CelebracionScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/modo-copero/celebracion').then((m) => ({
    default: m.default,
  })),
);

export default function ModoCoperoCelebracionRoute() {
  return (
    <View style={{ flex: 1 }} testID="modo-copero-celebracion-route">
      <Suspense fallback={null}>
        <CelebracionScreen />
      </Suspense>
      <VersionBadge variant="corner" testID="modo-copero-celebracion-version-badge" />
    </View>
  );
}
