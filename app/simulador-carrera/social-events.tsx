// app/simulador-carrera/social-events.tsx — MGC-1903
//
// Wrapper file-based para `/simulador-carrera/social-events` (F4). Replica
// el patrón de `post-match.tsx` / `season-hub.tsx`: archivo físico que
// registra la ruta en Expo Router + `lazy()` para preservar el code-split
// de pantalla (~10 KB on-demand).
//
// La pantalla es consumer de `state.socialEventPending` que el motor F4
// (`social-events.ts`) roleó durante `resolveMatchweek` (PR #438 mergeada
// SHA 354fbab8). post-match.tsx navega acá cuando hay pending; esta ruta
// drena el pending con `clearPostMatch` y vuelve al dashboard.
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const SocialEventsScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/social-events').then((m) => ({
    default: m.default,
  })),
);

export default function SocialEventsRoute() {
  return (
    <View style={{ flex: 1 }} testID="social-events-screen-wrapper">
      <Suspense fallback={null}>
        <SocialEventsScreen />
      </Suspense>
    </View>
  );
}