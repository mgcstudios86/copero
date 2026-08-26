import { Stack } from 'expo-router';
import { useTheme } from '@/design';

/**
 * MGC-841 — Layout del simulador de carrera.
 *
 * Las 3 pantallas (identity / dashboard / academy) viven como wrappers
 * file-based en `app/simulador-carrera/{identity,dashboard,academy}.tsx`.
 * Cada wrapper hace `lazy(() => import('@/features/simulador-carrera/screens/*'))`
 * preservando el code-split de MGC-771 (chunk asincrónico dedicado por pantalla,
 * ~14 KB gz on-demand) y registrando la ruta en Expo Router para que
 * `router.push('/simulador-carrera/dashboard')` resuelva sin "Unmatched Route".
 *
 * Bug MGC-836 / PR #128 (SHA de14888) — ticket MGC-841 asignado a mobile-developer:
 * antes (PR #115 MGC-771) este archivo registraba las 3 pantallas vía
 * `<Stack.Screen name="..." getComponent={...}>` sin archivo físico — el patrón
 * sólo funciona si Expo Router encuentra el entry point en `app/`. Sin archivo,
 * `router.push` devolvía `copero:///` → "Unmatched Route". El fix MGC-841 vuelve
 * al patrón file-based + `lazy()` en cada wrapper para conservar el split.
 */
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
    />
  );
}