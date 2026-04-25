import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { PhraseCategory } from './phrase';

export type TabName = 'Home' | 'Practice' | 'Favorites' | 'Settings';

export type PracticeRouteParams = {
  category?: PhraseCategory;
  phraseId?: string;
};

export type HomeStackParamList = {
  Home: undefined;
  PhraseList: {
    category: PhraseCategory;
  };
  Practice: PracticeRouteParams | undefined;
};

export type RootTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  PracticeTab: PracticeRouteParams | undefined;
  FavoritesTab: undefined;
  SettingsTab: undefined;
};

export type HomeScreenProps = NativeStackScreenProps<HomeStackParamList, 'Home'>;
export type PhraseListScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'PhraseList'
>;
export type PracticeStackScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'Practice'
>;
export type PracticeTabScreenProps = BottomTabScreenProps<
  RootTabParamList,
  'PracticeTab'
>;
export type FavoritesScreenProps = BottomTabScreenProps<
  RootTabParamList,
  'FavoritesTab'
>;
export type SettingsScreenProps = BottomTabScreenProps<
  RootTabParamList,
  'SettingsTab'
>;
