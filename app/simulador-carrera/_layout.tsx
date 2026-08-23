import { Stack } from 'expo-router';
import { useTheme } from '@/design';

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
      <Stack.Screen name="identity" options={{ title: 'Define tu identidad', headerBackVisible: false }} />
      <Stack.Screen name="dashboard" options={{ title: 'Tu carrera' }} />
      <Stack.Screen name="academy" options={{ title: 'Oferta del academy' }} />
    </Stack>
  );
}