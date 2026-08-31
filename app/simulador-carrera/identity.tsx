// app/simulador-carrera/identity.tsx — MGC-379
//
// Wrapper file-based route para `/simulador-carrera/identity`. Misma rationale
// que `dashboard.tsx`: la implementación vive en features/ (MGC-771 code-split)
// y se carga lazy acá. Sin este archivo la navegación al formulario de
// identidad devuelve "Unmatched Route" (mismo rootcause que MGC-838).
//
// MGC-379 fix: el contenedor externo debe montar IdentityScreen con
// `testID="identity-screen"` de forma INMEDIATA y UNCONDICIONAL. Antes el
// testID vivía sólo en el lazy chunk hijo y el wrapper `<Suspense>` no
// exponía ningún node testeable: los specs Playwright que esperaban el
// locator `identity-screen` apenas resolvía la ruta fallaban con timeout
// mientras el chunk bajaba. El wrapper ahora envuelve la Suspense en un
// `View` con `testID="identity-screen"` que se monta sincrónicamente, y el
// componente interno conserva su propio `testID` (el `ScrollView` interno
// del lazy chunk) para preservar selectores legacy.
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const IdentityScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/identity').then((m) => ({
    default: m.default,
  })),
);

export default function IdentityRoute() {
  return (
    <View testID="identity-screen" style={{ flex: 1 }}>
      <Suspense fallback={null}>
        <IdentityScreen />
      </Suspense>
    </View>
  );
}