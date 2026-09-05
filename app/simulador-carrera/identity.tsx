// app/simulador-carrera/identity.tsx — MGC-379 + MGC-429
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
// `View` con `testID="identity-screen"` que se monta sincrónicamente.
//
// MGC-429 fix: este wrapper es el ÚNICO nodo con `testID="identity-screen"`.
// El `ScrollView` interno del componente lazy (`src/features/.../identity.tsx`)
// NO debe repetirlo — antes lo hacía y rompía `getByTestId('identity-screen')`
// por strict-mode (2 elementos: wrapper `View` + `ScrollView`). Cualquier
// selector legacy del `ScrollView` interno debe apuntar al wrapper o a un
// testID distinto (ver MGC-429).
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