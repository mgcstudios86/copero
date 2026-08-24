// MGC-544 code-split: wrapper lazy() que Metro detecta como `import()`
// async y emite como chunk separado del entry. Contenido real en
// `ronda-impl.tsx` (engine de carrera + RoundTimer + WordCard).
import React, { lazy, Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native';

const RondaImpl = lazy(() => import('./ronda-impl'));

export default function Ronda() {
  return (
    <Suspense
      fallback={
        <View testID="ronda-loading" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      }
    >
      <RondaImpl />
    </Suspense>
  );
}