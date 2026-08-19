import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import PhraseCard from '../components/PhraseCard';
import ScrollToTopButton from '../components/ScrollToTopButton';
import { Icon, Screen } from '../components/ui';
import { useAppState } from '../context/AppStateContext';
import InlineBannerAd from '../features/ads/InlineBannerAd';
import {
  ANDROID_BOTTOM_BANNER_RESERVED_HEIGHT,
  showAdOnItemClick,
  useAndroidBottomBannerAd,
} from '../features/ads/mobileAds';
import PracticeModal from '../features/practice/PracticeModal';
import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  getPhraseAnalyticsParams,
  trackAnalyticsEvent,
} from '../services/analytics';
import { theme, withAlpha } from '../theme/theme';
import { languageMetadata } from '../types/language';
import { getPhraseDisplayTranslations } from '../utils/phraseDisplay';
import { phraseMatchesSearch } from '../utils/phraseSearch';

import type { Phrase } from '../types/phrase';

const INLINE_BANNER_FREQUENCY = 10;
const SCROLL_TO_TOP_BUTTON_THRESHOLD = 420;

function FavoritesScreen() {
  const isFocused = useIsFocused();
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
  const [searchQuery, setSearchQuery] = useState('');
  const emptyStateAnimation = useRef(new Animated.Value(0)).current;
  const emptyStateKeyRef = useRef<string | null>(null);
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
  const filteredSavedPhrases = useMemo(
    () =>
      savedPhrases.filter(phrase =>
        phraseMatchesSearch(
          phrase,
          searchQuery,
          nativeLanguage,
          favoriteFilterLanguage,
        ),
      ),
    [favoriteFilterLanguage, nativeLanguage, savedPhrases, searchQuery],
  );
  const activePhrase = useMemo(
    () => (activePhraseId ? getPhraseById(activePhraseId) : null),
    [activePhraseId, getPhraseById],
  );
  const shouldShowAndroidBottomBanner =
    Platform.OS === 'android' &&
    isFocused &&
    filteredSavedPhrases.length > INLINE_BANNER_FREQUENCY &&
    !activePhrase;

  useAndroidBottomBannerAd(shouldShowAndroidBottomBanner);

  const getSearchResultCountForQuery = (query: string) =>
    savedPhrases.filter(phrase =>
      phraseMatchesSearch(
        phrase,
        query,
        nativeLanguage,
        favoriteFilterLanguage,
      ),
    ).length;

  useEffect(() => {
    if (filteredSavedPhrases.length > 0) {
      emptyStateKeyRef.current = null;
      return;
    }

    const normalizedQuery = searchQuery.trim();
    const nextEmptyStateKey = `${favoriteFilterLanguage}:${normalizedQuery}`;

    if (emptyStateKeyRef.current === nextEmptyStateKey) {
      return;
    }

    emptyStateKeyRef.current = nextEmptyStateKey;
    trackAnalyticsEvent(ANALYTICS_EVENTS.EMPTY_STATE_VIEWED, {
      [ANALYTICS_PARAMS.FAVORITE_COUNT]: savedPhrases.length,
      [ANALYTICS_PARAMS.FAVORITE_LANG]: favoriteFilterLanguage,
      [ANALYTICS_PARAMS.HAS_QUERY]: normalizedQuery ? 'true' : 'false',
      [ANALYTICS_PARAMS.ORIGIN]: 'favorites_screen',
      [ANALYTICS_PARAMS.QUERY_LENGTH]: normalizedQuery.length,
      [ANALYTICS_PARAMS.RESULT_COUNT]: 0,
      [ANALYTICS_PARAMS.SCREEN]: 'Favourites',
    }).catch(() => undefined);
  }, [
    favoriteFilterLanguage,
    filteredSavedPhrases.length,
    savedPhrases.length,
    searchQuery,
  ]);

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

  const openPhrase = (phraseId: string, itemIndex?: number) => {
    const phrase = getPhraseById(phraseId);

    trackAnalyticsEvent(ANALYTICS_EVENTS.PHRASE_SELECTED, {
      ...getPhraseAnalyticsParams(
        phrase,
        nativeLanguage,
        favoriteFilterLanguage,
      ),
      [ANALYTICS_PARAMS.FAVORITE_LANG]: favoriteFilterLanguage,
      [ANALYTICS_PARAMS.ITEM_INDEX]: itemIndex,
      [ANALYTICS_PARAMS.ORIGIN]: 'favorites_list',
      [ANALYTICS_PARAMS.SCREEN]: 'Favourites',
    }).catch(() => undefined);

    showAdOnItemClick(() => {
      setActivePhraseId(phraseId);
    });
  };

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    trackAnalyticsEvent(ANALYTICS_EVENTS.SEARCH_CHANGED, {
      [ANALYTICS_PARAMS.FAVORITE_LANG]: favoriteFilterLanguage,
      [ANALYTICS_PARAMS.ORIGIN]: 'favorites_screen',
      [ANALYTICS_PARAMS.QUERY_LENGTH]: query.trim().length,
      [ANALYTICS_PARAMS.RESULT_COUNT]: getSearchResultCountForQuery(query),
      [ANALYTICS_PARAMS.SCREEN]: 'Favourites',
      [ANALYTICS_PARAMS.SEARCH_CONTEXT]: 'saved_phrases',
    }).catch(() => undefined);
  };

  const clearSearch = () => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.SEARCH_CLEARED, {
      [ANALYTICS_PARAMS.FAVORITE_LANG]: favoriteFilterLanguage,
      [ANALYTICS_PARAMS.ORIGIN]: 'favorites_screen',
      [ANALYTICS_PARAMS.QUERY_LENGTH]: searchQuery.trim().length,
      [ANALYTICS_PARAMS.RESULT_COUNT]: filteredSavedPhrases.length,
      [ANALYTICS_PARAMS.SCREEN]: 'Favourites',
    }).catch(() => undefined);
    setSearchQuery('');
  };

  const confirmDeletePhrase = (phrase: (typeof savedPhrases)[number]) => {
    const { helperTranslation } = getPhraseDisplayTranslations(
      phrase,
      nativeLanguage,
      favoriteFilterLanguage,
    );
    const phraseLabel = helperTranslation.text;

    trackAnalyticsEvent(ANALYTICS_EVENTS.CUSTOM_PHRASE_MODAL_OPENED, {
      ...getPhraseAnalyticsParams(
        phrase,
        nativeLanguage,
        favoriteFilterLanguage,
      ),
      [ANALYTICS_PARAMS.MODAL]: 'delete_custom_phrase',
      [ANALYTICS_PARAMS.ORIGIN]: 'favorites_screen',
    }).catch(() => undefined);

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

    if (shouldShowButton) {
      trackAnalyticsEvent(ANALYTICS_EVENTS.SCROLL_DEPTH_REACHED, {
        [ANALYTICS_PARAMS.FAVORITE_LANG]: favoriteFilterLanguage,
        [ANALYTICS_PARAMS.ORIGIN]: 'favorites_list',
        [ANALYTICS_PARAMS.SCREEN]: 'Favourites',
      }).catch(() => undefined);
    }
  };

  const scrollToTop = () => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.SCROLL_TO_TOP_PRESSED, {
      [ANALYTICS_PARAMS.FAVORITE_LANG]: favoriteFilterLanguage,
      [ANALYTICS_PARAMS.ORIGIN]: 'favorites_list',
      [ANALYTICS_PARAMS.SCREEN]: 'Favourites',
    }).catch(() => undefined);

    isScrollToTopButtonVisibleRef.current = false;
    setShowScrollToTopButton(false);
    listRef.current?.scrollToOffset({ animated: true, offset: 0 });
  };

  const renderEmptyState = () => {
    const hasSearchQuery = Boolean(searchQuery.trim());
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
          <Icon
            color={theme.colors.primary}
            name={hasSearchQuery ? 'search' : 'heart-outline'}
            size={34}
          />
        </Animated.View>
        <Text style={styles.emptyTitle}>
          {hasSearchQuery
            ? 'No words found'
            : hasSavedLanguages
              ? 'No favourites in this language'
              : 'No favourites yet'}
        </Text>
        <Text style={styles.emptyText}>
          {hasSearchQuery
            ? `No saved words match "${searchQuery.trim()}".`
            : hasSavedLanguages
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
          shouldShowAndroidBottomBanner
            ? styles.androidBottomBannerContent
            : null,
          filteredSavedPhrases.length === 0 && styles.emptyContent,
        ]}
        data={filteredSavedPhrases}
        keyExtractor={item => item.id}
        ListEmptyComponent={renderEmptyState}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.title}>Favourites</Text>
            </View>

            <View style={styles.searchBar}>
              <Icon color={theme.colors.mutedText} name="search" size={20} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={handleSearchQueryChange}
                placeholder="Search saved words"
                placeholderTextColor={theme.colors.mutedText}
                returnKeyType="search"
                style={styles.searchInput}
                value={searchQuery}
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  accessibilityLabel="Clear search"
                  hitSlop={10}
                  onPress={clearSearch}
                  style={({ pressed }) => [
                    styles.clearSearchButton,
                    pressed && styles.clearSearchButtonPressed,
                  ]}
                >
                  <Icon color={theme.colors.mutedText} name="close" size={18} />
                </Pressable>
              ) : null}
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
                {searchQuery.trim()
                  ? `${filteredSavedPhrases.length} result${
                      filteredSavedPhrases.length === 1 ? '' : 's'
                    }`
                  : `${savedPhrases.length} saved phrase${
                      savedPhrases.length === 1 ? '' : 's'
                    }`}
              </Text>
            </View>
          </View>
        }
        keyboardShouldPersistTaps="handled"
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
              onPress={() => openPhrase(item.id, index)}
              onToggleFavorite={() =>
                toggleFavorite(item.id, favoriteFilterLanguage)
              }
            />
            {(index + 1) % INLINE_BANNER_FREQUENCY === 0 &&
            index < filteredSavedPhrases.length - 1 ? (
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
  androidBottomBannerContent: {
    paddingBottom: theme.spacing.xxl + ANDROID_BOTTOM_BANNER_RESERVED_HEIGHT,
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
  searchBar: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
  },
  searchInput: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  clearSearchButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  clearSearchButtonPressed: {
    opacity: 0.6,
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
    transform: [{ scale: 0.99 }],
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
