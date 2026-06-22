import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { theme, withAlpha } from '../../theme/theme';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

type CardPressableProps = {
  children: ReactNode;
  onPress: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  pressedOverlayColor?: string;
  pressedOverlayOpacity?: number;
  pressedScale?: number;
};

function CardPressable({
  children,
  onPress,
  containerStyle,
  contentStyle,
  pressedOverlayColor = theme.colors.primary,
  pressedOverlayOpacity = 0.035,
  pressedScale = 0.992,
}: CardPressableProps) {
  return (
    <View style={[styles.shell, containerStyle]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.surface,
          contentStyle,
          pressed && { transform: [{ scale: pressedScale }] },
        ]}
      >
        {({ pressed }) => (
          <>
            <View style={styles.content}>{children}</View>
            {pressed ? (
              <View
                pointerEvents="none"
                style={[
                  styles.pressedOverlay,
                  {
                    backgroundColor: withAlpha(
                      pressedOverlayColor,
                      pressedOverlayOpacity,
                    ),
                  },
                ]}
              />
            ) : null}
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: theme.radius.lg,
    ...theme.shadows.card,
  },
  surface: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    zIndex: 1,
  },
  pressedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.lg,
  },
});

export default CardPressable;
