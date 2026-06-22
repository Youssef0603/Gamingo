import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import PhraseCard from '../src/components/PhraseCard';
import { theme } from '../src/theme/theme';

describe('PhraseCard', () => {
  test('keeps the card surface opaque while pressed', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <PhraseCard
          helperLanguage="en"
          isFavorite={false}
          item={{
            category: 'strategy',
            id: 'phrase-1',
            translations: {
              en: {
                meaning: 'Group up before pushing.',
                text: 'Group up',
              },
            },
          }}
          language="en"
          onPress={jest.fn()}
          onToggleFavorite={jest.fn()}
        />,
      );
    });

    const rootPressable = tree!.root.find(
      node =>
        typeof node.props.style === 'function' &&
        StyleSheet.flatten(node.props.style({ pressed: false })).padding ===
          theme.spacing.lg,
    );

    expect(
      StyleSheet.flatten(rootPressable.props.style({ pressed: true })),
    ).toMatchObject({
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      overflow: 'hidden',
      padding: theme.spacing.lg,
    });
  });
});
