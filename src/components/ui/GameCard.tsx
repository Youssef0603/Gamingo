import React, { PropsWithChildren, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import type {
  GestureResponderEvent,
  PressableProps,
  TextStyle,
} from 'react-native';

import { theme, withAlpha } from '../../theme/theme';

type GameCardGlow = 'primary' | 'secondary';

export type GameCardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  glow?: GameCardGlow;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
}> &
  Omit<PressableProps, 'children' | 'style'>;

function GameCard({
  children,
  title,
  subtitle,
  glow = 'primary',
  style,
  contentStyle,
  titleStyle,
  subtitleStyle,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...pressableProps
}: GameCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const glowColor =
    glow === 'secondary' ? theme.colors.secondary : theme.colors.primary;
  const glowShadowStyle =
    glow === 'secondary'
      ? theme.shadows.glowSecondary
      : theme.shadows.glowPrimary;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const handlePressIn = (event: GestureResponderEvent) => {
    animateTo(0.98);
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    animateTo(1);
    onPressOut?.(event);
  };

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...pressableProps}
    >
      <Animated.View
        style={[
          styles.card,
          theme.shadows.surface,
          glowShadowStyle,
          {
            borderColor: withAlpha(glowColor, 0.85),
            transform: [{ scale }],
          },
          disabled && styles.disabled,
          style,
        ]}
      >
        {title || subtitle ? (
          <View style={styles.header}>
            {title ? (
              <Text style={[styles.title, titleStyle]}>{title}</Text>
            ) : null}

            {subtitle ? (
              <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={contentStyle}>{children}</View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  title: {
    ...theme.typography.cardTitle,
  },
  subtitle: {
    ...theme.typography.caption,
  },
  disabled: {
    opacity: 0.55,
  },
});

export default GameCard;
