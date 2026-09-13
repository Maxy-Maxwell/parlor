import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CountAutoSolveCheckboxProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function CountAutoSolveCheckbox({ value, onValueChange }: CountAutoSolveCheckboxProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel="Count auto-solve in stats"
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View
        style={[
          styles.box,
          { borderColor: theme.text, backgroundColor: value ? theme.text : 'transparent' },
        ]}>
        {value ? (
          <ThemedText type="smallBold" themeColor="background" style={styles.mark}>
            ✓
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small">Count auto-solve in stats</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.75,
  },
  box: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    fontSize: 12,
    lineHeight: 14,
  },
});
