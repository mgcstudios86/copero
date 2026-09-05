// app/simulador-carrera/team-select.tsx — MGC-1648
//
// Wrapper file-based route para `/simulador-carrera/team-select`. Misma
// rationale que `identity.tsx` y `academy.tsx`: la implementación vive en
// features/ (MGC-771 code-split) y se carga lazy acá. Sin este archivo
// la navegación al team-select devuelve "Unmatched Route" (mismo
// rootcause que MGC-838 / MGC-841).
//
// `testID="team-select-screen"` vive en el wrapper View (MGC-379 + MGC-429)
// para que el screen esté disponible sincrónicamente al resolver la ruta,
// incluso antes de que el chunk lazy termine de cargar. QA hookea el
// subtree entero desde acá; cualquier spec Playwright que espere
// `getByTestId('team-select-screen')` no debe encontrar otro nodo con el
// mismo id dentro del lazy chunk.
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const TeamSelectScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/team-select').then((m) => ({
    default: m.default,
  })),
);

export default function TeamSelectRoute() {
  return (
    <View testID="team-select-screen" style={{ flex: 1 }}>
      <Suspense fallback={null}>
        <TeamSelectScreen />
      </Suspense>
    </View>
  );
}
