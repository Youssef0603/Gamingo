import React, { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';

import { theme } from '../../theme/theme';

export type ScreenProps = PropsWithChildren<{
  scrollable?: boolean;
  padded?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

function Screen({
  children,
  scrollable = false,
  padded = true,
  edges = ['top', 'right', 'bottom', 'left'],
  style,
  contentStyle,
}: ScreenProps) {
  const sharedContentStyle = [padded && styles.padded, contentStyle];

  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, style]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {scrollable ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, ...sharedContentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.flex}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, ...sharedContentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  padded: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
});

export default Screen;
