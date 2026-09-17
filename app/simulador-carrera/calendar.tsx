// app/simulador-carrera/calendar.tsx — MGC-212
//
// Wrapper file-based para `/simulador-carrera/calendar` (pantalla
// calendar semanal jugable). Mismo patrón que `season-hub.tsx`:
// archivo físico que registra la ruta en Expo Router + `lazy()`
// para preservar el code-split.
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const CalendarScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/calendar').then((m) => ({
    default: m.default,
  })),
);

export default function CalendarRoute() {
  return (
    <View style={{ flex: 1 }} testID="calendar-route">
      <Suspense fallback={null}>
        <CalendarScreen />
      </Suspense>
    </View>
  );
}