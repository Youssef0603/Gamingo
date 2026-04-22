import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { TabName } from '../types/navigation';

type BottomTabBarProps = {
  activeTab: TabName;
  onChangeTab: (tab: TabName) => void;
};

const tabs: TabName[] = ['Home', 'Favorites'];

function BottomTabBar({ activeTab, onChangeTab }: BottomTabBarProps) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.container}>
        {tabs.map(tab => {
          const isActive = tab === activeTab;

          return (
            <Pressable
              key={tab}
              onPress={() => onChangeTab(tab)}
              style={[styles.tab, isActive && styles.activeTab]}
            >
              <Text style={[styles.label, isActive && styles.activeLabel]}>{tab}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#0b1020',
  },
  container: {
    backgroundColor: '#10182f',
    borderTopColor: '#24304f',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  tab: {
    alignItems: 'center',
    backgroundColor: '#141b34',
    borderRadius: 16,
    flex: 1,
    paddingVertical: 14,
  },
  activeTab: {
    backgroundColor: '#0f766e',
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  activeLabel: {
    color: '#f8fafc',
  },
});

export default BottomTabBar;
