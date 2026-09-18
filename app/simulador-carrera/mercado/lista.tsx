// app/simulador-carrera/mercado/lista.tsx — MGC-475
//
// Route wrapper para `/simulador-carrera/mercado/lista` (pantalla 1/3 del
// flow mercado-de-pases). Pantalla real vive en
// `@/features/simulador-carrera/screens/mercado/lista-jugadores`.
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';
import { VersionBadge } from '@/design/components/VersionBadge';

const ListaJugadoresScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/mercado/lista-jugadores').then((m) => ({
    default: m.default,
  })),
);

export default function MercadoListaRoute() {
  return (
    <View style={{ flex: 1 }} testID="mercado-lista-route">
      <Suspense fallback={null}>
        <ListaJugadoresScreen />
      </Suspense>
      <VersionBadge variant="corner" testID="mercado-lista-version-badge" />
    </View>
  );
}