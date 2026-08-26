// app/simulador-carrera/dashboard.tsx — MGC-841
//
// Wrapper file-based route para `/simulador-carrera/dashboard`. La
// implementación vive en `src/features/simulador-carrera/screens/dashboard.tsx`
// (MGC-771 code-split) y se carga lazy acá para preservar el chunk asincrónico
// dedicado (~14 KB gz) que Metro emite on-demand al navegar, no eagerly en
// `/`. Sin este archivo Expo Router no resuelve `router.push('/simulador-carrera/dashboard')`
// y devuelve `copero:///` → "Unmatched Route" (bug MGC-836 / PR #128 SHA de14888,
// ticket MGC-841 asignado a mobile-developer).
//
// Antes (MGC-771, commit 20a801a PR #115) este archivo fue borrado y el route
// se registraba vía `<Stack.Screen name="dashboard" getComponent={...}>` en
// `_layout.tsx`. Ese patrón NO registra la ruta como entry point alcanzable
// por `router.push` — sólo funciona si el archivo existe.
import React, { Suspense, lazy } from 'react';

const DashboardScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/dashboard').then((m) => ({
    default: m.default,
  })),
);

export default function DashboardRoute() {
  return (
    <Suspense fallback={null}>
      <DashboardScreen />
    </Suspense>
  );
}