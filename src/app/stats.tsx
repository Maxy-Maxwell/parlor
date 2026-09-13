import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { StatWidget } from '@/components/stats/stat-widget';
import { DoughnutLegend, WinRateDoughnut } from '@/components/stats/win-rate-doughnut';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { formatElapsed } from '@/game/format-time';
import {
  averageWonMs,
  EMPTY_USER_STATS,
  type UserStats,
} from '@/game/user-stats';
import { loadUserStats } from '@/game/user-stats-store';
import { useTheme } from '@/hooks/use-theme';

const TABS = [{ id: 'solitaire', label: 'Solitaire' }] as const;
type DashboardTab = (typeof TABS)[number]['id'];

function formatWonTime(ms: number | null): string {
  if (ms == null) {
    return '—';
  }
  return formatElapsed(ms);
}

export default function StatsScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState<DashboardTab>('solitaire');
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

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View
            accessibilityRole="tablist"
            style={[styles.tabs, { backgroundColor: theme.backgroundElement }]}>
            {TABS.map((item) => {
              const selected = tab === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setTab(item.id)}
                  style={[
                    styles.tab,
                    selected && { backgroundColor: theme.background },
                  ]}>
                  <ThemedText type="smallBold">{item.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>

          {tab === 'solitaire' ? <SolitaireDashboard stats={stats} /> : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function SolitaireDashboard({ stats }: { stats: UserStats }) {
  const gamesWon = String(stats.gamesWon);
  const fastest = formatWonTime(stats.fastestWonMs);
  const average = formatWonTime(averageWonMs(stats));

  return (
    <View style={styles.dashboard}>
      <StatWidget title="Games won vs not completed">
        <WinRateDoughnut won={stats.gamesWon} unfinished={stats.gamesNotCompleted} />
        <DoughnutLegend />
      </StatWidget>

      <View style={styles.row}>
        <StatWidget title="Games won" style={styles.half}>
          <ThemedText
            type="subtitle"
            accessibilityLabel={`Games won ${gamesWon}`}
            style={styles.metric}>
            {gamesWon}
          </ThemedText>
        </StatWidget>
        <StatWidget title="Fastest win" style={styles.half}>
          <ThemedText
            type="subtitle"
            accessibilityLabel={`Fastest win ${fastest}`}
            style={styles.metric}>
            {fastest}
          </ThemedText>
        </StatWidget>
      </View>

      <StatWidget title="Average win time">
        <ThemedText
          type="subtitle"
          accessibilityLabel={`Average win time ${average}`}
          style={styles.metric}>
          {average}
        </ThemedText>
      </StatWidget>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
  tabs: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: Spacing.three,
    padding: Spacing.one,
  },
  tab: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  dashboard: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  half: {
    flex: 1,
  },
  metric: {
    fontVariant: ['tabular-nums'],
  },
});
