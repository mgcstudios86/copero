// app/simulador-carrera/index.tsx — MGC-397
//
// Defensive entry point para el segmento `simulador-carrera`. Antes este
// directorio NO tenía `index.tsx` (sólo `_layout.tsx` + las 8 pantallas):
// un `router.push('/simulador-carrera')` sin archivo de destino resolvía a
// una pantalla arbitraria del stack (Expo Router cae en la primera del
// `_layout`, que era `club`) y eso fue la causa raíz del bug MGC-397 /
// MGC-836 / MGC-841.
//
// Patrón (Opción B del ticket):
//   - Sin entry point explícito, `router.push('/simulador-carrera')` ya no
//     puede "caer" en club con perfil vacío.
//   - Si el segmento se navega por URL externa (deep-link, push notification,
//     web fallback), este index resuelve a la pantalla correcta según
//     `careerStage` persistido:
//       · sin carrera persistida  → /simulador-carrera/identity
//       · con carrera persistida  → /simulador-carrera/<stage>
//   - El home (`app/index.tsx`) sigue empujando directo a
//     `/simulador-carrera/identity` (AC #1) — este index es la red de
//     seguridad, no la ruta primaria.
//
// Mantener liviano: sólo usa `Redirect` de expo-router (no lazy imports
// porque no hay screen que renderizar acá, sólo dispatch).
import { Redirect } from 'expo-router';
import { useCareerStore } from '@/shared/store/careerStore';
import type { CareerStage } from '@/types/career';

// MGC-251 — mismo mapa que usa el home (`app/index.tsx:42`). Lo duplico acá
// para no exportar un helper desde el screen (acoplaría la lógica del
// home al segmento, lo que rompía el §1.2 de `engineering-workflow`).
function resumeRouteForStage(stage: CareerStage): string {
  switch (stage) {
    case 'identity':
      return '/simulador-carrera/identity';
    case 'dashboard':
    case 'academy':
    case 'clubStart':
      return '/simulador-carrera/dashboard';
    case 'draft':
      return '/simulador-carrera/draft';
    case 'club':
      return '/simulador-carrera/tu-jugador';
    case 'season':
      return '/simulador-carrera/temporada';
    case 'retirement':
      return '/simulador-carrera/fin-carrera';
    default:
      return '/simulador-carrera/dashboard';
  }
}

export default function SimuladorCarreraIndex() {
  const stage = useCareerStore((s) => s.stage);
  const profileName = useCareerStore((s) => s.profile.name);
  const hasCareer = stage !== 'identity' && profileName.length > 0;

  // Sin carrera persistida: ir siempre al form de identidad (MGC-397 AC #1).
  // Con carrera persistida: respetar el stage (MGC-397 AC #2).
  const target = hasCareer
    ? resumeRouteForStage(stage)
    : '/simulador-carrera/identity';

  return <Redirect href={target} />;
}
