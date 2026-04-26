import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type RootTabParamList = {
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
