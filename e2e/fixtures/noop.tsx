/**
 * Fixtures noop — placeholders para componentes que no deben ejecutarse en E2E.
 *
 * BannerAd e InterstitialOverlay dependen de SDKs nativos (AdMob) que no
 * están disponibles en headless Chromium ni en Expo Go sin dev client. Se
 * sustituyen por componentes vacíos vía Jest-style module mocking en
 * Playwright (pendiente wire en MGC-293).
 *
 * En Maestro mobile, el flujo home.yaml corre sin device — estos mocks
 * aplican solo si MGC-293 agrega specs que cargan ads.
 */
export const BannerAdNoop = () => null;
export const InterstitialOverlayNoop = () => null;
