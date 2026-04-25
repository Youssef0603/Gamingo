import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import type { TextStyle } from 'react-native';

import { theme, withAlpha } from '../../theme/theme';

type BadgeTone = 'primary' | 'secondary' | 'accent' | 'danger' | 'neutral';

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

function Badge({
  label,
  tone = 'primary',
  style,
  textStyle,
}: BadgeProps) {
  const toneColor =
    tone === 'neutral' ? theme.colors.textSecondary : theme.colors[tone];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: withAlpha(toneColor, tone === 'neutral' ? 0.12 : 0.16),
          borderColor: withAlpha(toneColor, tone === 'neutral' ? 0.28 : 0.5),
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.text,
          { color: tone === 'neutral' ? theme.colors.textPrimary : toneColor },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  text: {
    ...theme.typography.badgeLabel,
  },
});

export default Badge;
