import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type RootTabParamList = {
  Debug: undefined;
  Practice: undefined;
  Favourites: undefined;
};

export type TabName = keyof RootTabParamList;

export type PracticeScreenProps = BottomTabScreenProps<
  RootTabParamList,
  'Practice'
>;
export type FavoritesScreenProps = BottomTabScreenProps<
  RootTabParamList,
  'Favourites'
>;
export type DebugScreenProps = BottomTabScreenProps<RootTabParamList, 'Debug'>;
