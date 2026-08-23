import { Platform } from 'react-native';

import { Banner as WebBanner, Interstitial as WebInterstitial } from './provider.web';
import { Banner as NativeBanner, Interstitial as NativeInterstitial } from './provider.native';

export const Banner = Platform.OS === 'web' ? WebBanner : NativeBanner;
export const Interstitial = Platform.OS === 'web' ? WebInterstitial : NativeInterstitial;
