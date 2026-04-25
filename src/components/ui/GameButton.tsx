import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import type {
  GestureResponderEvent,
  PressableProps,
  TextStyle,
} from 'react-native';

import { theme, withAlpha } from '../../theme/theme';

type GameButtonVariant = 'primary' | 'secondary' | 'danger';

export type GameButtonProps = {
  title: string;
  variant?: GameButtonVariant;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
} & Omit<PressableProps, 'children' | 'style'>;

const variantStyles = {
  primary: {
    backgroundColor: withAlpha(theme.colors.primary, 0.16),
    borderColor: theme.colors.primary,
    shadowStyle: theme.shadows.glowPrimary,
  },
  secondary: {
    backgroundColor: withAlpha(theme.colors.secondary, 0.18),
    borderColor: theme.colors.secondary,
    shadowStyle: theme.shadows.glowSecondary,
  },
  danger: {
    backgroundColor: withAlpha(theme.colors.danger, 0.18),
    borderColor: theme.colors.danger,
    shadowStyle: theme.shadows.glowDanger,
  },
} as const;

function GameButton({
  title,
  variant = 'primary',
  fullWidth = false,
  style,
  textStyle,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...pressableProps
}: GameButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const currentVariant = variantStyles[variant];

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 32,
      bounciness: 0,
    }).start();
  };

  const handlePressIn = (event: GestureResponderEvent) => {
    animateTo(0.97);
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    animateTo(1);
    onPressOut?.(event);
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={fullWidth ? styles.fullWidth : undefined}
      {...pressableProps}
    >
      <Animated.View
        style={[
          styles.button,
          fullWidth && styles.fullWidth,
          theme.shadows.surface,
          currentVariant.shadowStyle,
          {
            backgroundColor: currentVariant.backgroundColor,
            borderColor: withAlpha(currentVariant.borderColor, 0.9),
            transform: [{ scale }],
          },
          disabled && styles.disabled,
          style,
        ]}
      >
        <Text style={[styles.label, textStyle]}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  label: {
    ...theme.typography.buttonLabel,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.55,
  },
});

export default GameButton;
