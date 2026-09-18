// app/onboarding/index.tsx — MGC-479
//
// Defensive entry point para el segmento `onboarding`. Mismo patrón que
// `app/simulador-carrera/index.tsx` (MGC-397 / MGC-841): sin archivo
// índice, `router.push('/onboarding')` sin destino resolvía a la primera
// pantalla del `_layout` (en este caso welcome, que sería correcto por
// casualidad — pero dependíamos de un orden frágil). El Redirect hace
// invariante el contrato.
import { Redirect } from 'expo-router';

export default function OnboardingIndex() {
  return <Redirect href="/onboarding/welcome" />;
}