import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const WON_COLOR = '#1f4e8c';

export function WinRateDoughnut({
  won,
  unfinished,
  size = 188,
}: {
  won: number;
  unfinished: number;
  size?: number;
}) {
  const theme = useTheme();
  const decided = won + unfinished;
  const percent = decided === 0 ? null : (won / decided) * 100;
  const strokeWidth = 22;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const wonRatio = percent == null ? 0 : Math.min(1, Math.max(0, percent / 100));
  const wonLength = wonRatio * circumference;
  const label = percent == null ? '—' : `${Math.round(percent)}%`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        percent == null
          ? 'Win rate unavailable. No finished games yet.'
          : `Win rate ${label}. ${won} won, ${unfinished} not completed.`
      }
      style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={decided === 0 ? theme.backgroundSelected : theme.textSecondary}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {wonLength > 0 ? (
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={WON_COLOR}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${wonLength} ${circumference}`}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ) : null}
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
  unfinished,
}: {
  won: number;
  unfinished: number;
}) {
  const theme = useTheme();
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, { backgroundColor: WON_COLOR }]} />
        <ThemedText accessible={false} style={styles.legendEmoji}>
          🏆
        </ThemedText>
        <ThemedText
          type="small"
          accessibilityLabel={`Won ${won}`}
          style={styles.legendLabel}>
          Won {won}
        </ThemedText>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, { backgroundColor: theme.textSecondary }]} />
        <ThemedText accessible={false} style={styles.legendEmoji}>
          🃏
        </ThemedText>
        <ThemedText
          type="small"
          accessibilityLabel={`Not Completed ${unfinished}`}
          style={styles.legendLabel}>
          Not Completed {unfinished}
        </ThemedText>
      </View>
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
