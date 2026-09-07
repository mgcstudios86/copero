// app/simulador-carrera/post-match.tsx — MGC-1650 (WF5 post-partido).
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const PostMatchScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/post-match').then((m) => ({
    default: m.default,
  })),
);

export default function PostMatchRoute() {
  return (
    <View style={{ flex: 1 }} testID="post-match-screen-wrapper">
      <Suspense fallback={null}>
        <PostMatchScreen />
      </Suspense>
    </View>
  );
}