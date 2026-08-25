import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/design';

/**
 * MGC-771 code-split: las 3 pantallas (academy, dashboard, identity) viven
 * en `src/features/simulador-carrera/screens/*` y se registran acá vía
 * `Stack.Screen` con `getComponent` lazy. Antes (PR #115 / commit a3af445)
 * existían wrappers `app/simulador-carrera/*.tsx` que Expo Router trataba
 * como entry points de la SPA — Metro emitía script defer para cada uno en
 * `dist/index.html` de `/`, inflando transfer a 571 KB y bloqueando LCP
 * (~4.38 s). Al sacar las rutas del filesystem de `app/` y registrarlas
 * explícitamente con `getComponent: () => import(...)`, Metro emite un
 * chunk asincrónico dedicado por pantalla (~14 KB gz cada uno) que se
 * descarga on-demand al navegar, no eagerly en `/`.
 *
 * El user llega a /simulador-carrera/identity desde el CTA del home
 * (HomepageCareerStarter, MGC-768). Desde identity va a dashboard y
 * desde dashboard a academy. Ninguno es reachable directo desde `/`,
 * por eso el split aggressive tiene sentido.
 */

// Expo Router 57 typings omiten `getComponent`; el runtime lo acepta y Metro
// lo respeta para emitir chunks asincrónicos. Cast a componente tipado con
// la prop opcional para destrabar typecheck.
const LazyScreen = Stack.Screen as unknown as React.ComponentType<{
  name: string;
  options?: Record<string, unknown>;
  getComponent?: () => Promise<React.ComponentType<unknown>>;
}>;

export default function CareerLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'fade',
      }}
    >
      <LazyScreen
        name="identity"
        options={{ title: 'Define tu identidad', headerBackVisible: false }}
        getComponent={() => import('@/features/simulador-carrera/screens/identity').then((m) => m.default)}
      />
      <LazyScreen
        name="dashboard"
        options={{ title: 'Tu carrera' }}
        getComponent={() => import('@/features/simulador-carrera/screens/dashboard').then((m) => m.default)}
      />
      <LazyScreen
        name="academy"
        options={{ title: 'Oferta del academy' }}
        getComponent={() => import('@/features/simulador-carrera/screens/academy').then((m) => m.default)}
      />
    </Stack>
  );
}
