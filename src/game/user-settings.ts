export type SolitaireSettings = {
  hideTimer: boolean;
};

export type UserSettings = {
  darkMode: boolean;
  solitaire: SolitaireSettings;
};

export const EMPTY_SOLITAIRE_SETTINGS: SolitaireSettings = {
  hideTimer: false,
};

export const EMPTY_USER_SETTINGS: UserSettings = {
  darkMode: false,
  solitaire: { hideTimer: false },
};

export function parseUserSettings(data: unknown): UserSettings {
  if (!isRecord(data)) {
    return { ...EMPTY_USER_SETTINGS, solitaire: { ...EMPTY_SOLITAIRE_SETTINGS } };
  }

  return {
    darkMode: data.darkMode === true,
    solitaire: parseSolitaireSettings(data.solitaire),
  };
}

function parseSolitaireSettings(data: unknown): SolitaireSettings {
  if (!isRecord(data) || typeof data.hideTimer !== 'boolean') {
    return { ...EMPTY_SOLITAIRE_SETTINGS };
  }
  return { hideTimer: data.hideTimer };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
