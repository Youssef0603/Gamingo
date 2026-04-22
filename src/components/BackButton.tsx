import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

type BackButtonProps = {
  onPress: () => void;
};

function BackButton({ onPress }: BackButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.button}>
      <Text style={styles.text}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#141b34',
    borderColor: '#24304f',
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default BackButton;
