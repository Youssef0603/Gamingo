import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import PhraseCard from '../components/PhraseCard';
import { Icon, Screen } from '../components/ui';
import { useAppState } from '../context/AppStateContext';
import InlineBannerAd from '../features/ads/InlineBannerAd';
import AddPhraseModal from '../features/phrases/AddPhraseModal';
import { showInterstitialBefore } from '../features/ads/mobileAds';
import PracticeModal from '../features/practice/PracticeModal';
import { theme, withAlpha } from '../theme/theme';
import { languageMetadata } from '../types/language';

const INLINE_AD_FREQUENCY = 3;

function FavoritesScreen() {
  const {
    addPhraseToFavorites,
    allPhrases,
    favoriteFilterLanguage,
    favoriteLanguageOptions,
    getFavoriteIdsForLanguage,
    getPhraseById,
    isFavorite,
    nativeLanguage,
    openLanguagePicker,
    toggleFavorite,
  } = useAppState();
  const [activePhraseId, setActivePhraseId] = useState<string | null>(null);
  const [isLookupModalVisible, setIsLookupModalVisible] = useState(false);
  const hasSavedLanguages = favoriteLanguageOptions.length > 0;
  const favoriteIds = getFavoriteIdsForLanguage(favoriteFilterLanguage);
  const favoriteLanguageOption = hasSavedLanguages
    ? languageMetadata[favoriteFilterLanguage]
    : null;

  const savedPhrases = useMemo(
    () =>
      favoriteIds
        .map(phraseId => getPhraseById(phraseId))
        .filter((phrase): phrase is NonNullable<typeof phrase> => Boolean(phrase)),
    [favoriteIds, getPhraseById],
  );
  const activePhrase = useMemo(
    () => (activePhraseId ? getPhraseById(activePhraseId) : null),
    [activePhraseId, getPhraseById],
  );

  useEffect(() => {
    if (activePhraseId && !favoriteIds.includes(activePhraseId)) {
      setActivePhraseId(null);
    }
  }, [activePhraseId, favoriteIds]);

  const openPhrase = (phraseId: string) => {
    showInterstitialBefore(() => {
      setActivePhraseId(phraseId);
    });
  };

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
        contentContainerStyle={styles.content}
        data={savedPhrases}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {hasSavedLanguages ? 'No favourites in this language' : 'No favourites yet'}
            </Text>
            <Text style={styles.emptyText}>
              {hasSavedLanguages
                ? 'Pick another saved language or save more phrases from Practice.'
                : 'Save phrases from Practice to build this list.'}
            </Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.title}>Favourites</Text>
              <Text style={styles.subtitle}>
                Saved phrases grouped by learning language.
              </Text>
            </View>

            <View style={styles.filterBlock}>
              <Text style={styles.filterLabel}>Saved language</Text>
              <Pressable
                disabled={!hasSavedLanguages}
                onPress={() => openLanguagePicker('favorites')}
                style={({ pressed }) => [
                  styles.languageTrigger,
                  !hasSavedLanguages && styles.languageTriggerDisabled,
                  pressed && hasSavedLanguages && styles.languageTriggerPressed,
                ]}
              >
                <View style={styles.languageTriggerCopy}>
                  <Text style={styles.languageFlag}>
                    {favoriteLanguageOption?.flag ?? '•'}
                  </Text>
                  <View style={styles.languageTextWrap}>
                    <Text style={styles.languageTriggerLabel}>Filter by</Text>
                    <Text
                      numberOfLines={1}
                      style={styles.languageTriggerValue}
                    >
                      {favoriteLanguageOption?.label ?? 'No saved languages yet'}
                    </Text>
                  </View>
                </View>

                {hasSavedLanguages ? (
                  <Icon
                    color={theme.colors.mutedText}
                    name="chevron-down"
                    size={18}
                  />
                ) : null}
              </Pressable>
            </View>

            <View style={styles.languageBadge}>
              <Text style={styles.languageText}>
                {savedPhrases.length} saved phrase{savedPhrases.length === 1 ? '' : 's'}
              </Text>
            </View>

            <View style={styles.lookupHeader}>
              <Text style={styles.filterLabel}>Add from your data</Text>
              <Pressable
                onPress={() => setIsLookupModalVisible(true)}
                style={({ pressed }) => [
                  styles.lookupToggle,
                  pressed && styles.lookupTogglePressed,
                ]}
              >
                <Text style={styles.lookupPlus}>+</Text>
                <Text style={styles.lookupToggleText}>Add</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <View>
            <PhraseCard
              helperLanguage={nativeLanguage}
              isFavorite={isFavorite(item.id, favoriteFilterLanguage)}
              item={item}
              language={favoriteFilterLanguage}
              onPress={() => openPhrase(item.id)}
              onToggleFavorite={() =>
                toggleFavorite(item.id, favoriteFilterLanguage)
              }
            />
            {(index + 1) % INLINE_AD_FREQUENCY === 0 &&
            index < savedPhrases.length - 1 ? (
              <InlineBannerAd />
            ) : null}
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />

      <PracticeModal
        isFavorite={
          activePhrase
            ? isFavorite(activePhrase.id, favoriteFilterLanguage)
            : false
        }
        helperLanguage={nativeLanguage}
        language={favoriteFilterLanguage}
        onClose={() => setActivePhraseId(null)}
        onToggleFavorite={() => {
          if (activePhrase) {
            toggleFavorite(activePhrase.id, favoriteFilterLanguage);
          }
        }}
        phrase={activePhrase}
        visible={Boolean(activePhrase)}
      />
      <AddPhraseModal
        helperLanguage={nativeLanguage}
        isFavorite={isFavorite}
        language={favoriteFilterLanguage}
        onAddPhrase={phrase =>
          addPhraseToFavorites(phrase, favoriteFilterLanguage)
        }
        onClose={() => setIsLookupModalVisible(false)}
        onOpenPhrase={openPhrase}
        phrases={allPhrases}
        visible={isLookupModalVisible}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  heading: {
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.title,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
  },
  filterBlock: {
    marginBottom: theme.spacing.md,
  },
  lookupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  lookupToggle: {
    alignItems: 'center',
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    borderColor: withAlpha(theme.colors.primary, 0.18),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lookupTogglePressed: {
    opacity: 0.85,
  },
  lookupToggleText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  lookupPlus: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 18,
  },
  filterLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  languageFlag: {
    fontSize: 24,
  },
  languageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  languageTextWrap: {
    flex: 1,
  },
  languageText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  languageTrigger: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  languageTriggerCopy: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  languageTriggerDisabled: {
    opacity: 0.7,
  },
  languageTriggerLabel: {
    color: theme.colors.mutedText,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  languageTriggerPressed: {
    opacity: 0.9,
  },
  languageTriggerValue: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  emptyText: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
  },
});

export default FavoritesScreen;
