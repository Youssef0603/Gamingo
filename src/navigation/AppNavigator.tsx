import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import BottomTabBar from '../components/BottomTabBar';
import { phrases } from '../data/phrases';
import {
  FavoritesScreen,
  HomeScreen,
  PhraseDetailScreen,
  PhraseListScreen,
} from '../screens';

import type { AppRoute, TabName } from '../types/navigation';
import type { PhraseCategory } from '../types/phrase';

const homeRoot: AppRoute = { name: 'Home' };
const favoritesRoot: AppRoute = { name: 'Favorites' };

function AppNavigator() {
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [homeStack, setHomeStack] = useState<AppRoute[]>([homeRoot]);
  const [favoritesStack, setFavoritesStack] = useState<AppRoute[]>([
    favoritesRoot,
  ]);

  const currentStack = activeTab === 'Home' ? homeStack : favoritesStack;
  const currentRoute = currentStack[currentStack.length - 1];

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const pushRoute = (route: AppRoute) => {
    if (activeTab === 'Home') {
      setHomeStack(current => [...current, route]);
      return;
    }

    setFavoritesStack(current => [...current, route]);
  };

  const handleBack = () => {
    if (activeTab === 'Home') {
      setHomeStack(current => (current.length > 1 ? current.slice(0, -1) : current));
      return;
    }

    setFavoritesStack(current =>
      current.length > 1 ? current.slice(0, -1) : current,
    );
  };

  const openCategory = (category: PhraseCategory) => {
    pushRoute({ name: 'PhraseList', category });
  };

  const openPhrase = (phraseId: string) => {
    pushRoute({ name: 'PhraseDetail', phraseId });
  };

  const toggleFavorite = (phraseId: string) => {
    setFavoriteIds(current =>
      current.includes(phraseId)
        ? current.filter(id => id !== phraseId)
        : [...current, phraseId],
    );
  };

  const handleChangeTab = (tab: TabName) => {
    setActiveTab(tab);
  };

  const openFavoritesTab = () => {
    setActiveTab('Favorites');
  };

  const detailPhrase =
    currentRoute.name === 'PhraseDetail'
      ? phrases.find(item => item.id === currentRoute.phraseId)
      : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.screen}>
        {currentRoute.name === 'Home' ? (
          <HomeScreen
            onOpenCategory={openCategory}
            onOpenFavorites={openFavoritesTab}
          />
        ) : null}

        {currentRoute.name === 'Favorites' ? (
          <FavoritesScreen
            favoriteIds={favoriteIds}
            onOpenPhrase={openPhrase}
            onToggleFavorite={toggleFavorite}
          />
        ) : null}

        {currentRoute.name === 'PhraseList' ? (
          <PhraseListScreen
            category={currentRoute.category}
            favoriteIds={favoriteIds}
            onBack={handleBack}
            onOpenPhrase={openPhrase}
            onToggleFavorite={toggleFavorite}
          />
        ) : null}

        {currentRoute.name === 'PhraseDetail' && detailPhrase ? (
          <PhraseDetailScreen
            isFavorite={favoriteSet.has(detailPhrase.id)}
            onBack={handleBack}
            onToggleFavorite={() => toggleFavorite(detailPhrase.id)}
            phrase={detailPhrase}
          />
        ) : null}
      </View>

      <BottomTabBar activeTab={activeTab} onChangeTab={handleChangeTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
  screen: {
    flex: 1,
  },
});

export default AppNavigator;
