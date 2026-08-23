import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../useTheme';

type Props = {
  score: number;
  bestStreak?: number;
  roundIndex?: number;
  totalRounds?: number;
  testID?: string;
};

export function ScoreBoard({ score, bestStreak, roundIndex, totalRounds, testID }: Props) {
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily } = useTheme();
  const muted = colors.textMuted;

  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      accessibilityLabel={`Marcador: ${score} puntos${bestStreak !== undefined ? `, mejor racha ${bestStreak}` : ''}${
        roundIndex !== undefined && totalRounds !== undefined
          ? `, ronda ${roundIndex} de ${totalRounds}`
          : ''
      }`}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[4],
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'space-around',
        gap: spacing[3],
      }}
    >
      <Stat
        label="Puntos"
        value={String(score)}
        accent={colors.primary}
        fontSize={fontSize.lg}
        fontFamily={fontFamily.mono}
        fontWeight={fontWeight.bold}
        muted={muted}
      />
      {bestStreak !== undefined ? (
        <Stat
          label="Racha"
          value={`🔥 ${bestStreak}`}
          accent={colors.accent}
          fontSize={fontSize.lg}
          fontFamily={fontFamily.body}
          fontWeight={fontWeight.semibold}
          muted={muted}
        />
      ) : null}
      {roundIndex !== undefined && totalRounds !== undefined ? (
        <Stat
          label="Ronda"
          value={`${roundIndex}/${totalRounds}`}
          accent={colors.info}
          fontSize={fontSize.lg}
          fontFamily={fontFamily.mono}
          fontWeight={fontWeight.medium}
          muted={muted}
        />
      ) : null}
    </View>
  );
}

function Stat({
  label,
  value,
  accent,
  fontSize: fs,
  fontFamily,
  fontWeight,
  muted,
}: {
  label: string;
  value: string;
  accent: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: '400' | '500' | '600' | '700';
  muted: string;
}) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text
        style={{
          color: accent,
          fontSize: fs,
          fontFamily,
          fontWeight,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: muted,
          fontSize: 12,
          marginTop: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
