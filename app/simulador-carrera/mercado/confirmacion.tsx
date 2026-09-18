// app/simulador-carrera/mercado/confirmacion.tsx — MGC-475
//
// Route wrapper para `/simulador-carrera/mercado/confirmacion` (pantalla 3/3).
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';
import { VersionBadge } from '@/design/components/VersionBadge';

const ConfirmacionTraspasoScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/mercado/confirmacion-traspaso').then((m) => ({
    default: m.default,
  })),
);

export default function MercadoConfirmacionRoute() {
  return (
    <View style={{ flex: 1 }} testID="mercado-confirmacion-route">
      <Suspense fallback={null}>
        <ConfirmacionTraspasoScreen />
      </Suspense>
      <VersionBadge variant="corner" testID="mercado-confirmacion-version-badge" />
    </View>
  );
}