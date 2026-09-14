/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useUserSettings } from '@/hooks/use-user-settings';

export function useTheme() {
  const { settings } = useUserSettings();
  return Colors[settings.darkMode ? 'dark' : 'light'];
}
