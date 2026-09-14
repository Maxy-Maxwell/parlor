import { StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function StatWidget({
  title,
  subtitle,
  emoji,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  emoji?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.widget, style]}>
      <View style={styles.header}>
        {emoji ? (
          <View style={[styles.emojiBadge, { backgroundColor: theme.background }]}>
            <ThemedText accessible={false} style={styles.emoji}>
              {emoji}
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.headerText}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.title}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText
              type="small"
              accessibilityLabel={subtitle}
              style={styles.subtitle}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  widget: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  emojiBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  headerText: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 36,
  },
  title: {
    letterSpacing: 0.2,
  },
  subtitle: {
    fontVariant: ['tabular-nums'],
  },
  body: {
    alignItems: 'center',
  },
});
