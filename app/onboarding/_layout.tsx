// app/onboarding/_layout.tsx — MGC-479
//
// Stack del segmento `onboarding`. Sólo aloja la pantalla `welcome` (spec
// PR #655 / MGC-479 onboarding-fresh-user step 1). Sin `headerShown` —
// la welcome screen es fullscreen (logo + body + CTA primario) y el
// SiteHeader global ya monta la nav superior. `animation: 'fade'` para
// que la transición Home → Welcome se sienta como una sola superficie,
// no un push nativo.
import { Stack } from 'expo-router';
import { useTheme } from '@/design';

export default function OnboardingLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'fade',
      }}
    />
  );
}