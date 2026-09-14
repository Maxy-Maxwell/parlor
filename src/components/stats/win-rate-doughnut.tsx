import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const WON_COLOR = '#1f4e8c';
const SOLVABLE_COLOR = '#c9a227';
const IMPOSSIBLE_COLOR = '#8c4a4a';

export function WinRateDoughnut({
  won,
  unfinishedSolvable,
  unfinishedImpossible,
  size = 188,
}: {
  won: number;
  unfinishedSolvable: number;
  unfinishedImpossible: number;
  size?: number;
}) {
  const theme = useTheme();
  const decided = won + unfinishedSolvable + unfinishedImpossible;
  const percent = decided === 0 ? null : (won / decided) * 100;
  const strokeWidth = 22;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const label = percent == null ? '—' : `${Math.round(percent)}%`;
  const slices = [
    { value: won, color: WON_COLOR },
    { value: unfinishedSolvable, color: SOLVABLE_COLOR },
    { value: unfinishedImpossible, color: IMPOSSIBLE_COLOR },
  ];

  let offset = 0;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        percent == null
          ? 'Win rate unavailable. No finished games yet.'
          : `Win rate ${label}. ${won} won, ${unfinishedSolvable} not completed solvable, ${unfinishedImpossible} not completed impossible.`
      }
      style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={decided === 0 ? theme.backgroundSelected : theme.background}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {slices.map((slice) => {
          if (slice.value <= 0 || decided === 0) {
            return null;
          }
          const length = (slice.value / decided) * circumference;
          const dashOffset = -offset;
          offset += length;
          return (
            <Circle
              key={slice.color}
              cx={cx}
              cy={cy}
              r={radius}
              stroke={slice.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${length} ${circumference}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
        })}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {percent == null ? (
          <>
            <ThemedText accessible={false} style={styles.emptyEmoji}>
              🃏
            </ThemedText>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Deal In
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText type="subtitle" style={styles.value}>
              {label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Win Rate
            </ThemedText>
          </>
        )}
      </View>
    </View>
  );
}

export function DoughnutLegend({
  won,
  unfinishedSolvable,
  unfinishedImpossible,
}: {
  won: number;
  unfinishedSolvable: number;
  unfinishedImpossible: number;
}) {
  return (
    <View style={styles.legend}>
      <LegendItem color={WON_COLOR} emoji="🏆" label={`Won ${won}`} />
      <LegendItem
        color={SOLVABLE_COLOR}
        emoji="🃏"
        label={`Not Completed (Solvable) ${unfinishedSolvable}`}
      />
      <LegendItem
        color={IMPOSSIBLE_COLOR}
        emoji="🚫"
        label={`Not Completed (Impossible) ${unfinishedImpossible}`}
      />
    </View>
  );
}

function LegendItem({
  color,
  emoji,
  label,
}: {
  color: string;
  emoji: string;
  label: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <ThemedText accessible={false} style={styles.legendEmoji}>
        {emoji}
      </ThemedText>
      <ThemedText type="small" accessibilityLabel={label} style={styles.legendLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
  emptyEmoji: {
    fontSize: 28,
    lineHeight: 34,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendEmoji: {
    fontSize: 14,
    lineHeight: 18,
  },
  legendLabel: {
    fontVariant: ['tabular-nums'],
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
