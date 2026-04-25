import React from 'react';
import { StyleSheet, View } from 'react-native';

import { theme, withAlpha } from '../../theme/theme';

type ProgressBarTone = 'primary' | 'secondary' | 'accent';

export type ProgressBarProps = {
  progress: number;
  tone?: ProgressBarTone;
};

function ProgressBar({ progress, tone = 'accent' }: ProgressBarProps) {
  const normalizedProgress = Math.max(0, Math.min(1, progress));
  const toneColor = theme.colors[tone];

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ max: 100, min: 0, now: Math.round(normalizedProgress * 100) }}
      style={styles.track}
    >
      <View
        style={[
          styles.fill,
          {
            backgroundColor: toneColor,
            shadowColor: toneColor,
            width: `${normalizedProgress * 100}%`,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: withAlpha(theme.colors.textPrimary, 0.08),
    borderColor: withAlpha(theme.colors.textPrimary, 0.08),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 12,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: theme.radius.pill,
    height: '100%',
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
});

export default ProgressBar;
