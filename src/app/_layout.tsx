import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { StackBackButton } from '@/components/stack-back-button';

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

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Home' }} />
        <Stack.Screen name="solitaire" options={{ headerShown: false, title: 'Solitaire' }} />
        <Stack.Screen
          name="stats"
          options={({ navigation }) => screenWithHomeBack(navigation, { title: 'Stats' })}
        />
        <Stack.Screen
          name="explore"
          options={({ navigation }) => screenWithHomeBack(navigation, { title: 'Explore' })}
        />
      </Stack>
    </ThemeProvider>
  );
}
