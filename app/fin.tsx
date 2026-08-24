// MGC-544 code-split: wrapper lazy() que Metro detecta como `import()`
// async y emite como chunk separado del entry. Contenido real en
// `fin-impl.tsx` (interstitial ad + adsStore + score final).
import React, { lazy, Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native';

const FinImpl = lazy(() => import('./fin-impl'));

export default function Fin() {
  return (
    <Suspense
      fallback={
        <View testID="fin-loading" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      }
    >
      <FinImpl />
    </Suspense>
  );
}