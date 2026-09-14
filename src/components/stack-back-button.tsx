import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

export function StackBackButton({
  label = 'Home',
  inNativeHeader = true,
}: {
  label?: string;
  inNativeHeader?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const iosLandscapeShift = inNativeHeader && Platform.OS === 'ios' && landscape ? -insets.left : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={goBackOrHome}
      style={({ pressed }) => [
        styles.button,
        iosLandscapeShift !== 0 ? { marginLeft: iosLandscapeShift } : null,
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingLeft: 0,
    paddingRight: Spacing.two,
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
