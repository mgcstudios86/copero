// app/simulador-carrera/transfer-offers.tsx — MGC-1803
//
// Wrapper file-based para `/simulador-carrera/transfer-offers` (pantalla
// de ofertas al cierre de temporada, F3.2 wire UX TR1).
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';
import { VersionBadge } from '@/design/components/VersionBadge';

const TransferOffersScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/transfer-offers').then((m) => ({
    default: m.default,
  })),
);

export default function TransferOffersRoute() {
  return (
    <View style={{ flex: 1 }} testID="transfer-offers-route">
      <Suspense fallback={null}>
        <TransferOffersScreen />
      </Suspense>
      <VersionBadge variant="corner" testID="transfer-offers-version-badge" />
    </View>
  );
}
