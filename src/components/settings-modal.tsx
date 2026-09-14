import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserSettings } from '@/hooks/use-user-settings';

const TABS = [
  { id: 'user', label: 'User' },
  { id: 'solitaire', label: 'Solitaire' },
] as const;
type SettingsTab = (typeof TABS)[number]['id'];

export function SettingsModal() {
  const theme = useTheme();
  const { settings, settingsOpen, closeSettings, setDarkMode, setHideTimer } = useUserSettings();
  const [tab, setTab] = useState<SettingsTab>('user');

  useEffect(() => {
    if (settingsOpen) {
      setTab('user');
    }
  }, [settingsOpen]);

  return (
    <Modal
      visible={settingsOpen}
      animationType="fade"
      transparent
      onRequestClose={closeSettings}>
      <ThemedView style={styles.overlay} accessibilityViewIsModal accessibilityLabel="Settings">
        <View style={styles.panel}>
          <ThemedText type="subtitle" style={styles.title}>
            Settings
          </ThemedText>

          <View
            accessibilityRole="tablist"
            style={[styles.tabs, { backgroundColor: theme.backgroundElement }]}>
            {TABS.map((item) => {
              const selected = tab === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected }}
                  onPress={() => setTab(item.id)}
                  style={[
                    styles.tab,
                    selected && { backgroundColor: theme.background },
                  ]}>
                  <ThemedText type="smallBold">{item.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.section}>
            {tab === 'user' ? (
              <SettingsToggle
                label="Dark Mode"
                value={settings.darkMode}
                onValueChange={setDarkMode}
              />
            ) : (
              <SettingsToggle
                label="Hide Timer"
                value={settings.solitaire.hideTimer}
                onValueChange={setHideTimer}
              />
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={closeSettings}
            style={({ pressed }) => [styles.donePressable, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={styles.doneButton}>
              <ThemedText type="subtitle" style={styles.doneLabel}>
                Done
              </ThemedText>
            </ThemedView>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
}

function SettingsToggle({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <ThemedText type="smallBold" style={styles.rowLabel}>
        {label}
      </ThemedText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        trackColor={{ false: theme.backgroundSelected, true: '#1f4e8c' }}
        thumbColor={theme.background}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    gap: Spacing.three,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    borderRadius: Spacing.three,
    padding: Spacing.one,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  section: {
    alignSelf: 'stretch',
  },
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
  },
  rowLabel: {
    flex: 1,
  },
  donePressable: {
    alignSelf: 'stretch',
    width: '100%',
  },
  doneButton: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  doneLabel: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
