import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export type MenuItem = {
  label: string;
  href?: Href;
  onPress?: () => void;
  disabled?: boolean;
};

export function MenuList({
  items,
  safeArea = true,
}: {
  items: MenuItem[];
  safeArea?: boolean;
}) {
  const content = (
    <ThemedView style={styles.menu}>
      {items.map((item) => {
        const button = (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ disabled: Boolean(item.disabled) }}
            disabled={item.disabled}
            onPress={item.disabled ? undefined : item.onPress}
            style={({ pressed }) => [
              styles.pressable,
              pressed && !item.disabled && styles.pressed,
              item.disabled && styles.disabled,
            ]}>
            <ThemedView type="backgroundElement" style={styles.button}>
              <ThemedText
                type="subtitle"
                themeColor={item.disabled ? 'textSecondary' : 'text'}
                style={styles.label}>
                {item.label}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );

        if (item.href && !item.disabled) {
          return (
            <Link key={item.label} href={item.href} withAnchor asChild>
              {button}
            </Link>
          );
        }

        return <View key={item.label}>{button}</View>;
      })}
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      {safeArea ? (
        <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>
      ) : (
        <View style={styles.safeArea}>{content}</View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  menu: {
    gap: Spacing.three,
    alignSelf: 'stretch',
  },
  pressable: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
  button: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  label: {
    textAlign: 'center',
  },
});
