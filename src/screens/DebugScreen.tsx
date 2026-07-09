import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import JSONTree from 'react-native-json-tree';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '../components/ui';
import { useAppStateDebugSnapshot } from '../context/AppStateContext';
import { theme, withAlpha } from '../theme/theme';

type JsonTreeValue =
  | null
  | boolean
  | number
  | string
  | JsonTreeValue[]
  | { [key: string]: JsonTreeValue };

const jsonTreeTheme = {
  scheme: 'gamingo-debug',
  author: 'OpenAI',
  base00: '#0F172A',
  base01: '#172036',
  base02: '#1E293B',
  base03: '#64748B',
  base04: '#94A3B8',
  base05: '#E2E8F0',
  base06: '#F8FAFC',
  base07: '#FFFFFF',
  base08: '#F87171',
  base09: '#F59E0B',
  base0A: '#FACC15',
  base0B: '#34D399',
  base0C: '#22D3EE',
  base0D: '#60A5FA',
  base0E: '#A78BFA',
  base0F: '#FB7185',
} as const;

async function loadAsyncStorageSnapshot() {
  const allKeys = await AsyncStorage.getAllKeys();
  const sortedKeys = [...allKeys].sort((left, right) =>
    left.localeCompare(right),
  );

  const values = await Promise.all(
    sortedKeys.map(async key => [key, await AsyncStorage.getItem(key)] as const),
  );

  return Object.fromEntries(
    values.map(([key, value]) => [key, parseStoredValue(value)]),
  );
}

function parseStoredValue(value: string | null) {
  if (value === null) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeJsonTreeValue(value: unknown): JsonTreeValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value ?? null;
  }

  if (Array.isArray(value)) {
    return value.map(item => normalizeJsonTreeValue(item));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        normalizeJsonTreeValue(nestedValue),
      ]),
    );
  }

  return String(value);
}

function getTreeData(value: JsonTreeValue) {
  const isStructuredValue =
    Array.isArray(value) || (typeof value === 'object' && value !== null);

  return {
    data: isStructuredValue ? value : { value },
    hideRoot: isStructuredValue,
  };
}

function DebugSectionCard({
  title,
  value,
}: {
  title: string;
  value: JsonTreeValue;
}) {
  const treeData = getTreeData(value);

  return (
    <View style={styles.itemCard}>
      <Text style={styles.itemLabel}>{title}</Text>
      <View style={styles.treeContainer}>
        <JSONTree
          data={treeData.data}
          hideRoot={treeData.hideRoot}
          invertTheme={false}
          shouldExpandNode={(_keyName, _data, level) => level < 2}
          sortObjectKeys
          theme={jsonTreeTheme}
        />
      </View>
    </View>
  );
}

function DebugScreen() {
  const isFocused = useIsFocused();
  const appStateDebugSnapshot = useAppStateDebugSnapshot();
  const [asyncStorageSnapshot, setAsyncStorageSnapshot] = useState<
    Record<string, unknown>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const globalStateSnapshot = useMemo(
    () => ({
      AppStateContext: appStateDebugSnapshot,
    }),
    [appStateDebugSnapshot],
  );

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    let isMounted = true;

    const loadAsyncStorageEntries = async (refreshing: boolean) => {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const nextEntries = await loadAsyncStorageSnapshot();

        if (!isMounted) {
          return;
        }

        setAsyncStorageSnapshot(nextEntries);
        setLoadError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Failed to load AsyncStorage entries.',
        );
      } finally {
        if (!isMounted) {
          return;
        }

        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    loadAsyncStorageEntries(false);

    return () => {
      isMounted = false;
    };
  }, [isFocused]);

  const refreshAsyncStorageEntries = async () => {
    setIsRefreshing(true);

    try {
      setAsyncStorageSnapshot(await loadAsyncStorageSnapshot());
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Failed to refresh AsyncStorage entries.',
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={refreshAsyncStorageEntries}
            refreshing={isRefreshing}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Debug</Text>
            <Text style={styles.subtitle}>
              Development-only view for persisted and global app state.
            </Text>
          </View>

          <Pressable
            onPress={refreshAsyncStorageEntries}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.refreshButtonPressed,
            ]}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Async Storage</Text>
            <Text style={styles.sectionMeta}>
              {Object.keys(asyncStorageSnapshot).length} item
              {Object.keys(asyncStorageSnapshot).length === 1 ? '' : 's'}
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={theme.colors.primary} size="small" />
              <Text style={styles.emptyStateText}>Loading stored entries...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Could not load AsyncStorage</Text>
              <Text style={styles.errorText}>{loadError}</Text>
            </View>
          ) : Object.keys(asyncStorageSnapshot).length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No AsyncStorage entries found.
              </Text>
            </View>
          ) : (
            <DebugSectionCard
              title="Stored Entries"
              value={normalizeJsonTreeValue(asyncStorageSnapshot)}
            />
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Global States</Text>
            <Text style={styles.sectionMeta}>1 source</Text>
          </View>

          <DebugSectionCard
            title="Live State"
            value={normalizeJsonTreeValue(globalStateSnapshot)}
          />
        </View>
      </ScrollView>
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
  },
  title: {
    ...theme.typography.title,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.caption,
    maxWidth: 260,
  },
  refreshButton: {
    backgroundColor: withAlpha(theme.colors.primary, 0.12),
    borderColor: withAlpha(theme.colors.primary, 0.2),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  refreshButtonPressed: {
    opacity: 0.8,
  },
  refreshButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.sectionTitle,
    fontSize: 22,
  },
  sectionMeta: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
  },
  itemCard: {
    ...theme.shadows.card,
    backgroundColor: theme.colors.card,
    borderColor: withAlpha(theme.colors.border, 0.9),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  itemLabel: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  treeContainer: {
    backgroundColor: '#0F172A',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    overflow: 'hidden',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: withAlpha(theme.colors.card, 0.96),
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  emptyStateText: {
    ...theme.typography.body,
    color: theme.colors.mutedText,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: withAlpha(theme.colors.danger, 0.08),
    borderColor: withAlpha(theme.colors.danger, 0.18),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  errorTitle: {
    color: theme.colors.danger,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  errorText: {
    ...theme.typography.body,
  },
});

export default DebugScreen;
