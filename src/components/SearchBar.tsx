import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search phrases',
}: SearchBarProps) {
  return (
    <View style={styles.container}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7380a6"
        selectionColor="#7dd3fc"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#141b34',
    borderColor: '#24304f',
    borderRadius: 16,
    borderWidth: 1,
    color: '#f8fafc',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});

export default SearchBar;
