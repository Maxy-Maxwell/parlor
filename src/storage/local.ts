import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StorageBackend } from './types';

/** Persists JSON on disk (native) or in the browser's localStorage (web). */
export const localBackend: StorageBackend = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
