import { retrieve, store } from '@/storage';

import { parseUserSettings, type UserSettings } from './user-settings';

export const USER_SETTINGS_KEY = 'user:settings';

export async function loadUserSettings(): Promise<UserSettings> {
  const data = await retrieve(USER_SETTINGS_KEY, 'local');
  return parseUserSettings(data);
}

export async function saveUserSettings(settings: UserSettings): Promise<UserSettings> {
  await store(USER_SETTINGS_KEY, settings, 'local');
  return settings;
}
