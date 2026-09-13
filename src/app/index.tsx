import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const MENU = [
  { href: '/solitaire' as const, number: '1', label: 'Solitaire' },
  { href: '/stats' as const, number: '2', label: 'Stats' },
];

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.menu}>
          {MENU.map((item) => (
            <Link key={item.href} href={item.href} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
                <ThemedView type="backgroundElement" style={styles.button}>
                  <ThemedText type="subtitle">
                    {item.number}. {item.label}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          ))}
        </ThemedView>
      </SafeAreaView>
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
  button: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
  },
});
