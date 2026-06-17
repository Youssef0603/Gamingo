import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from './ui';
import { theme, withAlpha } from '../theme/theme';

type ScrollToTopButtonProps = {
  visible: boolean;
  onPress: () => void;
};

function ScrollToTopButton({
  visible,
  onPress,
}: ScrollToTopButtonProps) {
  if (!visible) {
    return null;
  }

  return (
    <Pressable
      accessibilityHint="Scrolls back to the top of the list."
      accessibilityLabel="Scroll to top"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
      ]}
    >
      <Icon color="#FFFFFF" name="arrow-up" size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderColor: withAlpha('#FFFFFF', 0.28),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    bottom: theme.spacing.xl,
    height: 54,
    justifyContent: 'center',
    position: 'absolute',
    right: theme.spacing.lg,
    width: 54,
    zIndex: 10,
    ...theme.shadows.card,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
});

export default ScrollToTopButton;
