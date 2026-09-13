import { Stack } from 'expo-router';

import { StackBackButton } from '@/components/stack-back-button';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function SolitaireLayout() {
  return (
    <Stack>
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
