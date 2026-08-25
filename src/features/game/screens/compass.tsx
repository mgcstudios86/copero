/**
 * Ruta del Ideología Futbolística dentro del Expo Router.
 *
 * Esta ruta monta las pantallas de `src/screens/` y las conecta vía la fase del
 * store (`splash` | `playing` | `done`). La navegación interna (siguiente,
 * atrás, volver a empezar) la maneja el store; acá sólo se hace el dispatch
 * entre pantallas según la fase.
 */

import { useEffect } from 'react';
import { SplashScreen as Splash } from '@/screens/SplashScreen';
import { QuestionScreen } from '@/screens/QuestionScreen';
import { ResultScreen } from '@/screens/ResultScreen';
import { useQuizStore } from '@/state/quizStore';
import { storage } from '@/lib/storage';

export default function CompassRoute() {
  const phase = useQuizStore((s) => s.phase);
  const start = useQuizStore((s) => s.start);

  // Re-arranque: si quedamos en `playing` con respuestas parciales, mantenemos
  // el store como está; si la app vuelve del background sin fase definida
  // (porque `sessionStorage` no estaba disponible al primer render en SSR de web),
  // forzamos `splash`.
  useEffect(() => {
    if (!phase) {
      useQuizStore.setState({ phase: 'splash' });
    }
    // En SSR de web la storage API puede tirar; limpiamos cualquier basura.
    if (typeof window !== 'undefined' && !window.sessionStorage) {
      useQuizStore.setState({ phase: 'splash' });
    }
    // Tipado: import estático para que tsc no marque `storage` como unused.
    void storage;
  }, [phase]);

  const hasSavedProgress =
    phase === 'playing' ||
    (typeof window !== 'undefined' &&
      !!window.sessionStorage?.getItem('copero:ideologia:v1:quiz'));

  if (phase === 'splash') {
    return (
      <Splash
        onStart={start}
        hasSavedProgress={hasSavedProgress}
        onResume={() => start()}
      />
    );
  }

  if (phase === 'playing') {
    return (
      <QuestionScreen
        onAdvance={() => {
          /* store.next() ya se llamó dentro de la pantalla */
        }}
        onFinish={() => {
          /* store.next() setea phase='done' al llegar a la última pregunta */
        }}
      />
    );
  }

  // phase === 'done'
  return (
    <ResultScreen
      onRestart={() => {
        /* store.reset() ya se llamó dentro de la pantalla */
      }}
    />
  );
}