// app/simulador-carrera/club.tsx — MGC-42.C / MGC-50
//
// MGC-50 — Regresión introducida por `7b70f6b fix(club): redirigir a
// team-select (canónica WF2)`: el wrapper convirtió `/simulador-carrera/club`
// en un alias puro a `/simulador-carrera/team-select`. Esto rompió el flujo
// post-draft del botón `[data-testid="btn-tu-jugador-club"]` en
// `tu-jugador.tsx`, que navega a `/club` para mostrar las 4 tarjetas del
// catálogo MGC-209. Playwright `e2e/mgc396-visual-match.spec.ts` línea 85
// esperaba `**/simulador-carrera/club` y `club-screen` tras el click — el
// Redirect terminaba en `/team-select` y `waitForURL` expiraba (TimeoutError,
// 3 retries).
//
// Distinción de flujos:
//   WF2 (MGC-1648) alta: `/identity` → `/team-select` → `/season-hub`.
//     `team-select.tsx` es la pantalla canónica.
//   WF4 (MGC-209) post-draft: `/draft` (×8 picks) → `/tu-jugador` →
//     `/club` → `/temporada`. `SeleccionClubScreen` (alias `club`) es la
//     pantalla canónica; monta el catálogo filtrado por posición del jugador
//     (`clubsForPosition(group)`) y muestra 4 tarjetas con el CTA "Firmar
//     con {club}".
//
// El fix carga `SeleccionClubScreen` lazy (mismo patrón file-based que
// `team-select.tsx` para MGC-771 code-split) y mantiene los guards internos
// de la pantalla (`stage === 'season' && profile.club` → temporada, sin
// card/draft → tu-jugador) para que deep links malformados no cuelguen.
import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';

const SeleccionClubScreen = lazy(() =>
  import('@/features/simulador-carrera/screens/club').then((m) => ({
    default: m.default,
  })),
);

export default function ClubRoute() {
  return (
    <View testID="club-screen-wrapper" style={{ flex: 1 }}>
      <Suspense fallback={null}>
        <SeleccionClubScreen />
      </Suspense>
    </View>
  );
}