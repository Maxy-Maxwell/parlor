import { Stack } from 'expo-router';

export default function SolitaireLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Solitaire' }} />
      <Stack.Screen name="play" options={{ title: 'Solitaire' }} />
    </Stack>
  );
}
