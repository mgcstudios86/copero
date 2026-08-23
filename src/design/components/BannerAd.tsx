import React from 'react';
import { View, AccessibilityRole } from 'react-native';
import { Banner } from '@/features/ads';

/**
 * `complementary` no figura en `AccessibilityRole` del RN que tenemos pinned
 * (0.86.2), pero es un rol ARIA estándar para landmarks publicitarios y lo
 * respetan screen readers modernos. Cast explícito para no romper tsc.
 */
const COMPLEMENTARY_ROLE = 'complementary' as AccessibilityRole;

type Props = {
  testID?: string;
  /** Slot opcional para AdSense / AdMob. */
  slot?: string;
};

/**
 * Banner fijo al pie de cada pantalla jugable. Sigue la guía de `00-index.md`:
 * banner siempre visible mientras hay contenido jugable. Delega al provider
 * existente (`@/features/ads`) que ya incluye placeholder + a11y label.
 *
 * A11y: el wrapper expone role="complementary" + label="Publicidad" para que
 * screen readers lo anuncien como zona publicitaria complementaria al contenido.
 */
export function BannerAd({ testID, slot }: Props) {
  return (
    <View
      testID={testID}
      accessibilityRole={COMPLEMENTARY_ROLE}
      accessibilityLabel="Publicidad"
    >
      <Banner slotId={slot} />
    </View>
  );
}
