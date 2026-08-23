import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * ClubCrest — escudo genérico de club (MGC-466).
 *
 * Reproduce el shape de los assets SVG `design/simulador-carrera/assets/shields/*.svg`
 * (forma de escudo estilizada, banda blanca/contraste, 3 letras del club) usando
 * Views nativos para compatibilidad cross-platform sin `react-native-svg`.
 *
 * Los assets originales sirven como referencia visual; este componente aplica
 * los mismos colores (`crestColor` + `crestAccent`) ya definidos en
 * `src/features/career/clubs.ts`. Sin logos registrados (per MGC-465 AC).
 *
 * Props:
 *  - club: { id, name, crestColor, crestAccent } — el club del academy.
 *  - size: diámetro en px (default 72, igual al placeholder que reemplaza).
 *  - testID: opcional; default `crest-${club.id}`.
 */
export interface ClubCrestClub {
  id: string;
  name: string;
  crestColor: string;
  crestAccent: string;
}

export interface ClubCrestProps {
  club: ClubCrestClub;
  size?: number;
  testID?: string;
}

function initials(name: string): string {
  // Toma las primeras 3 letras, mayúsculas, sin acentos.
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '');
  return (cleaned || '???').slice(0, 3).toUpperCase();
}

export function ClubCrest({
  club,
  size = 72,
  testID,
}: ClubCrestProps): React.ReactElement {
  const id = testID ?? `crest-${club.id}`;
  // Forma de escudo: cuerpo rectangular alto con bordes superiores rectos y
  // base apuntada (simulada con borderBottomRadius grande).
  const bandHeight = Math.max(8, Math.round(size * 0.18));
  const initialsSize = Math.round(size * 0.32);
  const monogram = initials(club.name);

  return (
    <View
      testID={id}
      accessibilityRole="image"
      accessibilityLabel={`Escudo de ${club.name}`}
      style={[
        styles.crest,
        {
          width: size,
          height: size,
          backgroundColor: club.crestColor,
          borderColor: club.crestAccent,
          borderBottomLeftRadius: size * 0.5,
          borderBottomRightRadius: size * 0.5,
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
        },
      ]}
    >
      {/* Monograma (3 letras) — zona superior */}
      <Text
        style={[
          styles.monogram,
          {
            color: club.crestAccent,
            fontSize: initialsSize,
            top: size * 0.18,
          },
        ]}
        numberOfLines={1}
      >
        {monogram}
      </Text>
      {/* Banda horizontal de contraste — separa monograma de base */}
      <View
        style={[
          styles.band,
          {
            backgroundColor: club.crestAccent,
            height: bandHeight,
            top: size * 0.55 - bandHeight / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  crest: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    overflow: 'hidden',
  },
  monogram: {
    position: 'absolute',
    left: 4,
    right: 4,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
