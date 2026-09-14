import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useUserSettings } from '@/hooks/use-user-settings';

export function SettingsButton() {
  const { openSettings } = useUserSettings();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={8}
      onPress={openSettings}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <ThemedText type="smallBold">Settings</ThemedText>
    </Pressable>
  );
}

export function SettingsHeaderRight({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      {children}
      <SettingsButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  button: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    marginRight: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
