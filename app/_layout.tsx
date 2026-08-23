import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { Banner } from '@/features/ads';
import { ThemeProvider, useTheme } from '@/design';

function ThemedShell() {
  const { colors, mode } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="categoria" options={{ title: 'Elegí categoría' }} />
        <Stack.Screen name="ronda" options={{ title: 'Ronda', headerBackVisible: false }} />
        <Stack.Screen name="fin" options={{ title: 'Fin del copero', headerBackVisible: false }} />
        <Stack.Screen
          name="compass"
          options={{ title: 'Ideología Futbolística', headerBackVisible: true }}
        />
      </Stack>
      <Banner />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
