import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import PhraseCard from '../src/components/PhraseCard';
import { theme, withAlpha } from '../src/theme/theme';

describe('PhraseCard', () => {
  test('keeps visible feedback on card press', async () => {
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
    const style = rootPressable.props.style as (
      state: { pressed: boolean }
    ) => unknown;

    expect(typeof style).toBe('function');
    expect(
      StyleSheet.flatten(style({ pressed: true })).backgroundColor,
    ).toBe(withAlpha(theme.colors.primary, 0.03));
  });
});
