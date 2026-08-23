import { create } from 'zustand';

type AdsStore = {
  interstitialPending: boolean;
  interstitialShown: boolean;
  requestInterstitial: () => void;
  markInterstitialShown: () => void;
};

/**
 * Estado global de ads. No persistimos (es ephemeral).
 * El componente `<Interstitial />` observa este store y dispara la unidad
 * publicitaria cuando `interstitialPending === true` y `shown === false`.
 */
export const useAdsStore = create<AdsStore>((set) => ({
  interstitialPending: false,
  interstitialShown: false,
  requestInterstitial: () =>
    set({ interstitialPending: true, interstitialShown: false }),
  markInterstitialShown: () =>
    set({ interstitialPending: false, interstitialShown: true }),
}));
