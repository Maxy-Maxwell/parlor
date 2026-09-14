import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  EMPTY_USER_SETTINGS,
  type UserSettings,
} from '@/game/user-settings';
import { loadUserSettings, saveUserSettings } from '@/game/user-settings-store';

type UserSettingsContextValue = {
  settings: UserSettings;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  setDarkMode: (darkMode: boolean) => void;
  setHideTimer: (hideTimer: boolean) => void;
};

const UserSettingsContext = createContext<UserSettingsContextValue | null>(null);

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(EMPTY_USER_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadUserSettings().then((next) => {
      if (!cancelled && !dirtyRef.current) {
        setSettings(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback((patch: (current: UserSettings) => UserSettings) => {
    dirtyRef.current = true;
    setSettings((current) => {
      const next = patch(current);
      void saveUserSettings(next);
      return next;
    });
  }, []);

  const setDarkMode = useCallback(
    (darkMode: boolean) => {
      updateSettings((current) => ({ ...current, darkMode }));
    },
    [updateSettings],
  );

  const setHideTimer = useCallback(
    (hideTimer: boolean) => {
      updateSettings((current) => ({
        ...current,
        solitaire: { ...current.solitaire, hideTimer },
      }));
    },
    [updateSettings],
  );

  const value = useMemo<UserSettingsContextValue>(
    () => ({
      settings,
      settingsOpen,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
      setDarkMode,
      setHideTimer,
    }),
    [setDarkMode, setHideTimer, settings, settingsOpen],
  );

  return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>;
}

export function useUserSettings(): UserSettingsContextValue {
  const value = useContext(UserSettingsContext);
  if (value == null) {
    throw new Error('useUserSettings must be used within UserSettingsProvider');
  }
  return value;
}
