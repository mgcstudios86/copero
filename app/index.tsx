/**
 * MGC-1188 — Eliminar pantalla inicial.
 *
 * El operador indica que la pantalla de splash/intro rompe la UX. Antes
 * esta ruta (`/`) renderizaba un hero con título "Convertite en leyenda",
 * descripción y un botón "Jugar" que empuja a `/simulador-carrera/identity`.
 * La pantalla era marketing, no parte del juego.
 *
 * Fix: la home deja de ser una screen visible y queda como un dispatcher
 * puro. Calcula la ruta correcta del simulador en función del `stage`
 * persistido y la sirve vía `<Redirect>`. El cold-start nativo (post
 * `pm clear` + `am start`) aterriza directo en:
 *   - `/simulador-carrera/dashboard` cuando hay carrera persistida.
 *   - `/simulador-carrera/identity` cuando NO hay carrera (es el primer
 *     paso funcional del juego: el form para crear el perfil del jugador;
 *     no es splash, no es onboarding decorativo, es la pantalla 1/6 del
 *     flow carrera — MGC-209).
 *
 * Loader inline: el gate `hydrated` ya vive en `app/_layout.native.tsx`
 * (y las variantes web/default) y bloquea el render del Stack hasta que
 * `hydrateFromSave()` resuelva. Acá no necesitamos spinner propio; el
 * `<Redirect>` se ejecuta en el mismo render post-hidratación.
 *
 * Sin tocar:
 *   - `_layout.tsx` / `_layout.native.tsx` / `_layout.web.tsx`: el
 *     `initialRouteName="index"` y el hydration gate se conservan tal
 *     cual (MGC-534, MGC-722, MGC-653).
 *   - `simulador-carrera/index.tsx`: sigue siendo la red de seguridad
 *     para `router.push('/simulador-carrera')` sin stage (MGC-841 / MGC-397).
 *   - Game flow (identity → dashboard → academy → draft → ...): intacto.
 *   - Splash nativo de Expo (`app.json` `expo.splash` + plugin
 *     `expo-splash-screen`): sólo aplica al cold-start nativo antes del
 *     primer render JS; es comportamiento del OS, no es una pantalla
 *     decidimos mostrar.
 *
 * Compatibilidad de specs: el home-screen testID se ELIMINÓ junto con la
 * splash. Varias specs Playwright (`e2e/home.spec.ts`,
 * `e2e/siteheader.spec.ts`, `e2e/mgc-317-qa.spec.ts`,
 * `e2e/mgc-462-contrast.spec.ts`, `e2e/a11y-keyboard.spec.ts`,
 * `e2e/_visual-regression.spec.ts`) afirmaban ese nodo y/o el CTA
 * `btn-career`. Ambas referencias son obsoletas tras MGC-1188 y deben
 * reescribirse en el child ticket del handoff — el despacho en este
 * archivo es instantáneo (mismo render post-hidratación), por lo que
 * `await page.goto('/')` equivaldrá a aterrizar en `/simulador-carrera/*`.
 */
import { Redirect } from 'expo-router';
import { useCareerStore } from '@/shared/store/careerStore';
import type { CareerStage } from '@/types/career';

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

export default function HomeDispatcher() {
  const stage = useCareerStore((s) => s.stage);
  const profileName = useCareerStore((s) => s.profile.name);
  const hasCareer = stage !== 'identity' && profileName.length > 0;

  // MGC-1188: con carrera persistida → dashboard directo (mapa de
  // decisiones). Sin carrera → identity, que es la pantalla 1 del flow
  // MGC-209 (no es splash, es el form del primer perfil).
  const target = hasCareer
    ? resumeRouteForStage(stage)
    : '/simulador-carrera/identity';

  return <Redirect href={target} />;
}
