import * as Device from 'expo-device';
import { Stack } from 'expo-router';

import { SettingsHeaderRight } from '@/components/settings-button';
import { StackBackButton } from '@/components/stack-back-button';
import { useTheme } from '@/hooks/use-theme';

const playOrientation = Device.deviceType === Device.DeviceType.PHONE ? 'landscape' : 'portrait';

const playScreenOptions = {
  orientation: playOrientation,
  headerBackVisible: false,
  unstable_nativeProps: {
    headerConfig: {
      disableLeftInsetApplication: true,
    },
  },
} as const;

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
        orientation: 'portrait',
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
        options={({ navigation }) => ({
          title: 'Solitaire',
          headerLeft: () => (
            <StackBackButton label={navigation.canGoBack() ? 'Back' : 'Home'} />
          ),
          ...playScreenOptions,
        })}
      />
    </Stack>
  );
}
