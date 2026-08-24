// MGC-544 code-split: wrapper lazy() que Metro detecta como `import()`
// async y emite como chunk separado del entry. Contenido real en
// `categoria-impl.tsx`.
import React, { lazy, Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native';

const CategoriaImpl = lazy(() => import('./categoria-impl'));

export default function Categoria() {
  return (
    <Suspense
      fallback={
        <View testID="categoria-loading" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      }
    >
      <CategoriaImpl />
    </Suspense>
  );
}