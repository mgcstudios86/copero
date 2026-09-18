// app/simulador-carrera/academy.tsx — MGC-841
//
// Wrapper file-based route para `/simulador-carrera/academy`. Misma rationale
// que `dashboard.tsx`: la implementación vive en features/ (MGC-771 code-split)
// y se carga lazy acá. Sin este archivo la navegación al academy devuelve
// "Unmatched Route" (mismo rootcause que MGC-838).
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const AcademyScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/academy').then((m) => ({
    default: m.default,
  })),
);

export default function AcademyRoute() {
  return (
    <View style={{ flex: 1 }} testID="academy-screen">
      <Suspense fallback={null}>
        <AcademyScreen />
      </Suspense>
    </View>
  );
}