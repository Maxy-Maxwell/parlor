import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { formatElapsed } from '@/game/format-time';
import {
  averageWonMs,
  EMPTY_USER_STATS,
  winRatePercent,
  type UserStats,
} from '@/game/user-stats';
import { loadUserStats } from '@/game/user-stats-store';

function formatWinRate(stats: UserStats): string {
  const rate = winRatePercent(stats);
  if (rate == null) {
    return '—';
  }
  return `${Math.round(rate)}%`;
}

function formatWonTime(ms: number | null): string {
  if (ms == null) {
    return '—';
  }
  return formatElapsed(ms);
}

export default function StatsScreen() {
  const [stats, setStats] = useState<UserStats>(EMPTY_USER_STATS);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadUserStats().then((next) => {
        if (!cancelled) {
          setStats(next);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const rows = [
    { label: 'Games won', value: String(stats.gamesWon) },
    { label: 'Win rate', value: formatWinRate(stats) },
    { label: 'Average win time', value: formatWonTime(averageWonMs(stats)) },
    { label: 'Fastest win', value: formatWonTime(stats.fastestWonMs) },
  ];

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary">
              {row.label}
            </ThemedText>
            <ThemedText
              type="subtitle"
              accessibilityLabel={`${row.label} ${row.value}`}>
              {row.value}
            </ThemedText>
          </View>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.four,
  },
  row: {
    gap: Spacing.one,
  },
});
