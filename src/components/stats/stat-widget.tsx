import { StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export function StatWidget({
  title,
  children,
  style,
}: {
  title: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <ThemedView type="backgroundElement" style={[styles.widget, style]}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title}
      </ThemedText>
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
  body: {
    alignItems: 'center',
  },
});
