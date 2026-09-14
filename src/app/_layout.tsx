import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SettingsHeaderRight } from '@/components/settings-button';
import { SettingsModal } from '@/components/settings-modal';
import { StackBackButton } from '@/components/stack-back-button';
import { useTheme } from '@/hooks/use-theme';
import { UserSettingsProvider, useUserSettings } from '@/hooks/use-user-settings';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'index',
};

function screenWithHomeBack(
  navigation: { canGoBack: () => boolean },
  options: { title: string },
) {
  if (navigation.canGoBack()) {
    return options;
  }
  return {
    ...options,
    headerLeft: () => <StackBackButton />,
  };
}

function ThemedRoot() {
  const theme = useTheme();
  const { settings } = useUserSettings();
  const dark = settings.darkMode;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    document.documentElement.style.backgroundColor = theme.background;
    document.body.style.backgroundColor = theme.background;
  }, [theme.background]);

  return (
    <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <AnimatedSplashOverlay />
      <Stack
        screenOptions={{
          headerRight: () => <SettingsHeaderRight />,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerTitleStyle: { color: theme.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
          orientation: 'portrait',
        }}>
        <Stack.Screen name="index" options={{ title: 'Home' }} />
        <Stack.Screen
          name="solitaire"
          options={{ headerShown: false, title: 'Solitaire', orientation: 'default' }}
        />
        <Stack.Screen
          name="stats"
          options={({ navigation }) => screenWithHomeBack(navigation, { title: 'Stats' })}
        />
        <Stack.Screen
          name="explore"
          options={({ navigation }) => screenWithHomeBack(navigation, { title: 'Explore' })}
        />
      </Stack>
      <SettingsModal />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <UserSettingsProvider>
      <ThemedRoot />
    </UserSettingsProvider>
  );
}
