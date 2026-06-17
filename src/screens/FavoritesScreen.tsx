import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import PhraseCard from '../components/PhraseCard';
import ScrollToTopButton from '../components/ScrollToTopButton';
import { Icon, Screen } from '../components/ui';
import { useAppState } from '../context/AppStateContext';
import InlineBannerAd from '../features/ads/InlineBannerAd';
import { showAdOnItemClick } from '../features/ads/mobileAds';
import PracticeModal from '../features/practice/PracticeModal';
import { theme, withAlpha } from '../theme/theme';
import { languageMetadata } from '../types/language';
import { getPhraseDisplayTranslations } from '../utils/phraseDisplay';

import type { Phrase } from '../types/phrase';

const INLINE_BANNER_FREQUENCY = 10;
const SCROLL_TO_TOP_BUTTON_THRESHOLD = 420;

function FavoritesScreen() {
  const {
    deleteCustomPhrase,
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
  const emptyStateAnimation = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<Phrase>>(null);
  const isScrollToTopButtonVisibleRef = useRef(false);
  const [showScrollToTopButton, setShowScrollToTopButton] = useState(false);
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

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(emptyStateAnimation, {
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(emptyStateAnimation, {
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [emptyStateAnimation]);

  const openPhrase = (phraseId: string) => {
    showAdOnItemClick(() => {
      setActivePhraseId(phraseId);
    });
  };

  const confirmDeletePhrase = (phrase: (typeof savedPhrases)[number]) => {
    const { helperTranslation } = getPhraseDisplayTranslations(
      phrase,
      nativeLanguage,
      favoriteFilterLanguage,
    );
    const phraseLabel = helperTranslation.text;

    Alert.alert('Delete custom word?', `Remove "${phraseLabel}" from Custom?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteCustomPhrase(phrase.id);
        },
      },
    ]);
  };

  const handleListScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const shouldShowButton =
      event.nativeEvent.contentOffset.y > SCROLL_TO_TOP_BUTTON_THRESHOLD;

    if (isScrollToTopButtonVisibleRef.current === shouldShowButton) {
      return;
    }

    isScrollToTopButtonVisibleRef.current = shouldShowButton;
    setShowScrollToTopButton(shouldShowButton);
  };

  const scrollToTop = () => {
    isScrollToTopButtonVisibleRef.current = false;
    setShowScrollToTopButton(false);
    listRef.current?.scrollToOffset({ animated: true, offset: 0 });
  };

  const renderEmptyState = () => {
    const badgeAnimationStyle = {
      opacity: emptyStateAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0.92, 1],
      }),
      transform: [
        {
          scale: emptyStateAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.06],
          }),
        },
        {
          translateY: emptyStateAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -6],
          }),
        },
      ],
    };

    return (
      <View style={styles.emptyStateWrap}>
        <View style={styles.emptyGlow} />
        <Animated.View style={[styles.emptyBadge, badgeAnimationStyle]}>
          <Icon color={theme.colors.primary} name="heart-outline" size={34} />
        </Animated.View>
        <Text style={styles.emptyTitle}>
          {hasSavedLanguages ? 'No favourites in this language' : 'No favourites yet'}
        </Text>
        <Text style={styles.emptyText}>
          {hasSavedLanguages
            ? 'Pick another saved language or keep exploring Practice to fill this space.'
            : 'Save phrases from Practice and they will show up here.'}
        </Text>
      </View>
    );
  };

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
        ref={listRef}
        contentContainerStyle={[
          styles.content,
          savedPhrases.length === 0 && styles.emptyContent,
        ]}
        data={savedPhrases}
        keyExtractor={item => item.id}
        ListEmptyComponent={renderEmptyState}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.title}>Favourites</Text>
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
          </View>
        }
        onScroll={handleListScroll}
        renderItem={({ item, index }) => (
          <View>
            <PhraseCard
              helperLanguage={nativeLanguage}
              isFavorite={isFavorite(item.id, favoriteFilterLanguage)}
              item={item}
              language={favoriteFilterLanguage}
              onDelete={
                item.category === 'custom'
                  ? () => confirmDeletePhrase(item)
                  : undefined
              }
              onPress={() => openPhrase(item.id)}
              onToggleFavorite={() =>
                toggleFavorite(item.id, favoriteFilterLanguage)
              }
            />
            {(index + 1) % INLINE_BANNER_FREQUENCY === 0 &&
            index < savedPhrases.length - 1 ? (
              <InlineBannerAd />
            ) : null}
          </View>
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />

      <ScrollToTopButton
        onPress={scrollToTop}
        visible={showScrollToTopButton}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  emptyContent: {
    flexGrow: 1,
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
  filterBlock: {
    marginBottom: theme.spacing.md,
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
  emptyStateWrap: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
    overflow: 'hidden',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
    ...theme.shadows.card,
  },
  emptyGlow: {
    borderRadius: theme.radius.pill,
    height: 140,
    marginBottom: -92,
    width: 140,
  },
  emptyBadge: {
    alignItems: 'center',
    backgroundColor: withAlpha(theme.colors.primary, 0.1),
    borderColor: withAlpha(theme.colors.primary, 0.18),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    width: 88,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.mutedText,
    maxWidth: 260,
    textAlign: 'center',
  },
});

export default FavoritesScreen;
