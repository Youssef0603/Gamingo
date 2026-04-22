import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type CategoryCardProps = {
  title: string;
  description: string;
  onPress: () => void;
};

function CategoryCard({ title, description, onPress }: CategoryCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.badge} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141b34',
    borderColor: '#24304f',
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  badge: {
    backgroundColor: '#7dd3fc',
    borderRadius: 999,
    height: 10,
    marginBottom: 12,
    width: 42,
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default CategoryCard;
