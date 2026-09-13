import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function goHome() {
  router.replace('/');
}

export function goBackOrHome() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  goHome();
}

export function StackBackButton({ label = 'Home' }: { label?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={goBackOrHome}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
