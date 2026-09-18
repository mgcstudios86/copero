// app/simulador-carrera/modo-copero/seleccion.tsx — MGC-490
//
// Route wrapper para `/simulador-carrera/modo-copero/seleccion` (pantalla 1/3
// del flow modo-copero). Pantalla real vive en
// `@/features/simulador-carrera/screens/modo-copero/seleccion-copa`.
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';
import { VersionBadge } from '@/design/components/VersionBadge';

const SeleccionCopaScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/modo-copero/seleccion-copa').then((m) => ({
    default: m.default,
  })),
);

export default function ModoCoperoSeleccionRoute() {
  return (
    <View style={{ flex: 1 }} testID="modo-copero-seleccion-route">
      <Suspense fallback={null}>
        <SeleccionCopaScreen />
      </Suspense>
      <VersionBadge variant="corner" testID="modo-copero-seleccion-version-badge" />
    </View>
  );
}
