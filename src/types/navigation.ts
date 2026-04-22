import type { PhraseCategory } from './phrase';

export type TabName = 'Home' | 'Favorites';

export type HomeRoute = {
  name: 'Home';
};

export type FavoritesRoute = {
  name: 'Favorites';
};

export type PhraseListRoute = {
  name: 'PhraseList';
  category: PhraseCategory;
};

export type PhraseDetailRoute = {
  name: 'PhraseDetail';
  phraseId: string;
};

export type AppRoute =
  | HomeRoute
  | FavoritesRoute
  | PhraseListRoute
  | PhraseDetailRoute;
