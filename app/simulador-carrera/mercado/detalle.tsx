// app/simulador-carrera/mercado/detalle.tsx — MGC-475
//
// Route wrapper para `/simulador-carrera/mercado/detalle` (pantalla 2/3).
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';
import { VersionBadge } from '@/design/components/VersionBadge';

const DetalleJugadorScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/mercado/detalle-jugador').then((m) => ({
    default: m.default,
  })),
);

export default function MercadoDetalleRoute() {
  return (
    <View style={{ flex: 1 }} testID="mercado-detalle-route">
      <Suspense fallback={null}>
        <DetalleJugadorScreen />
      </Suspense>
      <VersionBadge variant="corner" testID="mercado-detalle-version-badge" />
    </View>
  );
}