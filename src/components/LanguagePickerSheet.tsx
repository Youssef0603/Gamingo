import React, { useMemo, useState } from 'react';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';

import { bottomSheetModalRef } from './BottomSheet';
import { Icon } from './ui';
import { theme } from '../theme/theme';
import { languageMetadata, supportedLanguageCodes } from '../types/language';

import type { LanguageCode } from '../types/language';

type LanguagePickerSheetProps = {
  availableLanguages?: LanguageCode[];
  emptyStateText?: string;
  subtitle: string;
  selectedLanguage: LanguageCode;
  title: string;
  onSelect: (language: LanguageCode) => void;
};

function LanguagePickerSheet({
  availableLanguages = supportedLanguageCodes,
  emptyStateText = 'Try a different name or language code.',
  subtitle,
  selectedLanguage,
  title,
  onSelect,
}: LanguagePickerSheetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { height } = useWindowDimensions();

  const filteredLanguages = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return availableLanguages;
    }

    return availableLanguages.filter(language => {
      const item = languageMetadata[language];

      return (
        item.label.toLowerCase().includes(normalizedQuery) ||
        language.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [availableLanguages, searchQuery]);

  const contentHeight = height * 0.8;

  return (
    <BottomSheetView style={[styles.container, { height: contentHeight }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearchQuery}
          placeholder="Search language"
          placeholderTextColor={theme.colors.mutedText}
          returnKeyType="search"
          style={styles.searchInput}
          value={searchQuery}
        />
      </View>

      <View style={styles.results}>
        <FlatList
          contentContainerStyle={
            filteredLanguages.length === 0
              ? styles.listEmptyContent
              : styles.listContent
          }
          data={filteredLanguages}
          keyExtractor={item => item}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Icon color={theme.colors.mutedText} name="search" size={28} />
              </View>
              <Text style={styles.emptyTitle}>No language found</Text>
              <Text style={styles.emptyText}>{emptyStateText}</Text>
            </View>
          }
          renderItem={({ item: language }: { item: LanguageCode }) => {
            const item = languageMetadata[language];
            const isSelected = language === selectedLanguage;

            return (
              <Pressable
                onPress={() => {
                  onSelect(language);
                  bottomSheetModalRef.current?.dismiss();
                }}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
              >
                <View style={styles.optionCopy}>
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={styles.optionLabel}>{item.label}</Text>
                </View>

                {isSelected ? (
                  <Icon
                    color={theme.colors.primary}
                    name="checkmark-circle"
                    size={20}
                  />
                ) : null}
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </BottomSheetView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  header: {
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
  },
  searchBar: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
  },
  searchInput: {
    color: theme.colors.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  results: {
    flex: 1,
  },
  listContent: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  listEmptyContent: {
    flexGrow: 1,
  },
  option: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  optionCopy: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  optionLabel: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionSelected: {
    borderColor: theme.colors.primary,
  },
  flag: {
    fontSize: 20,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  emptyIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  emptyText: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
    textAlign: 'center',
  },
});

export default LanguagePickerSheet;
