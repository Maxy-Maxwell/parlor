import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { StatWidget } from '@/components/stats/stat-widget';
import { DoughnutLegend, WinRateDoughnut } from '@/components/stats/win-rate-doughnut';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { formatElapsed } from '@/game/format-time';
import type { DrawCount } from '@/game/solitaire';
import {
  averageWonMs,
  EMPTY_USER_STATS,
  statsForDraws,
  type UserStats,
  type VariantStats,
  winRatePercent,
} from '@/game/user-stats';
import { loadUserStats, resetUserStats } from '@/game/user-stats-store';
import { useTheme } from '@/hooks/use-theme';

const TABS = [{ id: 'solitaire', label: '♠️  Solitaire' }] as const;
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
  const [confirmReset, setConfirmReset] = useState(false);

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

  const confirmResetStats = () => {
    void resetUserStats().then((next) => {
      setStats(next);
      setConfirmReset(false);
    });
  };

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
                  accessibilityLabel="Solitaire"
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset Stats"
            onPress={() => setConfirmReset(true)}
            style={({ pressed }) => [styles.resetPressable, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={styles.resetButton}>
              <ThemedText accessible={false} style={styles.resetEmoji}>
                🧹
              </ThemedText>
              <ThemedText type="smallBold" style={styles.resetLabel}>
                Reset Stats
              </ThemedText>
            </ThemedView>
          </Pressable>
        </View>
      </ScrollView>

      {confirmReset ? (
        <ThemedView
          style={styles.overlay}
          accessibilityViewIsModal
          accessibilityLabel="Reset Stats?">
          <View style={styles.confirmMenu}>
            <ThemedText accessible={false} style={styles.confirmEmoji}>
              🧹
            </ThemedText>
            <ThemedText type="subtitle" style={styles.confirmTitle}>
              Reset Stats?
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.confirmTitle}>
              This permanently clears your Solitaire scoreboard. This cannot be undone.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset"
              onPress={confirmResetStats}
              style={({ pressed }) => [styles.confirmAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.confirmButton}>
                <ThemedText type="subtitle" style={styles.resetLabel}>
                  Reset
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep Stats"
              onPress={() => setConfirmReset(false)}
              style={({ pressed }) => [styles.confirmAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.confirmButton}>
                <ThemedText type="subtitle" style={styles.resetLabel}>
                  Keep Stats
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>
        </ThemedView>
      ) : null}
    </ThemedView>
  );
}

function gamesPlayedLabel(total: number): string {
  return total === 1 ? '1 Game Played' : `${total} Games Played`;
}

function scorecardBlurb(stats: VariantStats): string {
  const played = stats.gamesWon + stats.gamesNotCompleted;
  if (played === 0) {
    return 'No Hands Yet — Deal A Game!';
  }
  const rate = winRatePercent(stats) ?? 0;
  if (rate >= 75) {
    return "You're On Fire!";
  }
  if (rate >= 50) {
    return 'Hot Streak Energy!';
  }
  if (rate >= 25) {
    return 'The Cards Will Turn!';
  }
  return 'Every Deal Is A Fresh Chance!';
}

function FilterChip({
  label,
  selected,
  fill,
  ink,
  onPress,
}: {
  label: string;
  selected: boolean;
  fill: string;
  ink: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.filter,
        { backgroundColor: selected ? fill : theme.backgroundElement },
      ]}>
      <ThemedText type="small" style={[styles.filterLabel, selected && { color: ink }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function SolitaireDashboard({ stats }: { stats: UserStats }) {
  const theme = useTheme();
  const [oneCard, setOneCard] = useState(true);
  const [threeCard, setThreeCard] = useState(true);
  const draws: DrawCount[] = [
    ...(oneCard ? ([1] as const) : []),
    ...(threeCard ? ([3] as const) : []),
  ];
  const visible = statsForDraws(stats, draws);
  const gamesWon = String(visible.gamesWon);
  const gamesPlayed = visible.gamesWon + visible.gamesNotCompleted;
  const fastest = formatWonTime(visible.fastestWonMs);
  const average = formatWonTime(averageWonMs(visible));
  const scorecardTitle =
    oneCard && threeCard ? 'Solitaire Scorecard' : oneCard ? '1 Card Scorecard' : '3 Card Scorecard';

  const toggleOneCard = () => {
    if (oneCard && !threeCard) {
      return;
    }
    setOneCard((value) => !value);
  };

  const toggleThreeCard = () => {
    if (threeCard && !oneCard) {
      return;
    }
    setThreeCard((value) => !value);
  };

  const dark = theme.background === '#000000';
  const selectedFill = dark ? '#2A4A6A' : '#D6E8F7';
  const selectedInk = dark ? '#C9DEF2' : '#1F4E8C';

  return (
    <View style={styles.dashboard}>
      <View
        accessibilityRole="toolbar"
        accessibilityLabel="Solitaire stats filters"
        style={styles.filters}>
        <FilterChip label="1 Card" selected={oneCard} fill={selectedFill} ink={selectedInk} onPress={toggleOneCard} />
        <FilterChip
          label="3 Card"
          selected={threeCard}
          fill={selectedFill}
          ink={selectedInk}
          onPress={toggleThreeCard}
        />
      </View>

      <View style={styles.banner}>
        <ThemedText accessible={false} style={styles.suits}>
          ♠️   ♥️   ♦️   ♣️
        </ThemedText>
        <ThemedText type="smallBold" style={styles.bannerTitle}>
          {scorecardTitle}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.bannerBlurb}>
          {scorecardBlurb(visible)}
        </ThemedText>
      </View>

      <StatWidget
        emoji="🎯"
        title="Games Won Vs Not Completed"
        subtitle={gamesPlayedLabel(gamesPlayed)}>
        <WinRateDoughnut
          won={visible.gamesWon}
          unfinishedSolvable={visible.gamesNotCompletedSolvable}
          unfinishedImpossible={visible.gamesNotCompletedImpossible}
        />
        <DoughnutLegend
          won={visible.gamesWon}
          unfinishedSolvable={visible.gamesNotCompletedSolvable}
          unfinishedImpossible={visible.gamesNotCompletedImpossible}
        />
      </StatWidget>

      <View style={styles.row}>
        <StatWidget emoji="🏆" title="Games Won" style={styles.half}>
          <ThemedText
            type="subtitle"
            accessibilityLabel={`Games Won ${gamesWon}`}
            style={styles.metric}>
            {gamesWon}
          </ThemedText>
        </StatWidget>
        <StatWidget emoji="⚡" title="Fastest Win" style={styles.half}>
          <ThemedText
            type="subtitle"
            accessibilityLabel={`Fastest Win ${fastest}`}
            style={styles.metric}>
            {fastest}
          </ThemedText>
        </StatWidget>
      </View>

      <StatWidget emoji="🕒" title="Average Win Time">
        <ThemedText
          type="subtitle"
          accessibilityLabel={`Average Win Time ${average}`}
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
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.two,
  },
  filter: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  filterLabel: {
    fontSize: 16,
    lineHeight: 21,
  },
  banner: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  bannerTitle: {
    letterSpacing: 0.4,
    fontSize: 16,
  },
  suits: {
    fontSize: 22,
    lineHeight: 28,
  },
  bannerBlurb: {
    textAlign: 'center',
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
  resetPressable: {
    alignSelf: 'stretch',
  },
  resetButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  resetEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  resetLabel: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    zIndex: 20,
  },
  confirmMenu: {
    width: '100%',
    maxWidth: 420,
    gap: Spacing.three,
    alignItems: 'center',
  },
  confirmTitle: {
    textAlign: 'center',
  },
  confirmEmoji: {
    fontSize: 48,
    lineHeight: 56,
  },
  confirmAction: {
    alignSelf: 'stretch',
    width: '100%',
  },
  confirmButton: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
});
