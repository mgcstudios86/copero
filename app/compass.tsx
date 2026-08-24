// MGC-544 code-split: wrapper lazy() que Metro detecta como `import()`
// async y emite como chunk separado del entry. Contenido real en
// `compass-impl.tsx` (SplashScreen + QuestionScreen + ResultScreen +
// quizStore).
import React, { lazy, Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native';

const CompassImpl = lazy(() => import('./compass-impl'));

export default function Compass() {
  return (
    <Suspense
      fallback={
        <View testID="compass-loading" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      }
    >
      <CompassImpl />
    </Suspense>
  );
}