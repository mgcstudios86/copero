import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { Banner } from '@/features/ads';
import { colors } from '@/features/ui/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="categoria" options={{ title: 'Elegí categoría' }} />
          <Stack.Screen name="ronda" options={{ title: 'Ronda', headerBackVisible: false }} />
          <Stack.Screen name="fin" options={{ title: 'Fin del copero', headerBackVisible: false }} />
          <Stack.Screen name="compass" options={{ title: 'Ideología Futbolística', headerBackVisible: true }} />
        </Stack>
        <Banner />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
