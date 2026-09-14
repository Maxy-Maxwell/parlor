import { Stack } from 'expo-router';

import { SettingsHeaderRight } from '@/components/settings-button';
import { StackBackButton } from '@/components/stack-back-button';
import { useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function SolitaireLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerRight: () => <SettingsHeaderRight />,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen
        name="index"
        options={({ navigation }) =>
          navigation.canGoBack()
            ? { title: 'Solitaire' }
            : { title: 'Solitaire', headerLeft: () => <StackBackButton /> }
        }
      />
      <Stack.Screen
        name="play"
        options={({ navigation }) =>
          navigation.canGoBack()
            ? { title: 'Solitaire' }
            : { title: 'Solitaire', headerLeft: () => <StackBackButton /> }
        }
      />
    </Stack>
  );
}
