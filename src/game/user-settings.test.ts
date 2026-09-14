import assert from 'node:assert/strict';

import { EMPTY_USER_SETTINGS, parseUserSettings } from './user-settings.ts';

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok ${name}`);
}

test('parseUserSettings reads darkMode and solitaire flags', () => {
  assert.deepEqual(parseUserSettings({ darkMode: true }), {
    darkMode: true,
    solitaire: { hideTimer: false },
  });
  assert.deepEqual(
    parseUserSettings({ darkMode: false, solitaire: { hideTimer: true } }),
    {
      darkMode: false,
      solitaire: { hideTimer: true },
    },
  );
});

test('parseUserSettings falls back to empty settings for invalid payloads', () => {
  assert.deepEqual(parseUserSettings(null), EMPTY_USER_SETTINGS);
  assert.deepEqual(parseUserSettings({}), EMPTY_USER_SETTINGS);
  assert.deepEqual(parseUserSettings({ darkMode: 'yes' }), EMPTY_USER_SETTINGS);
  assert.deepEqual(
    parseUserSettings({ darkMode: true, solitaire: { hideTimer: 'yes' } }),
    {
      darkMode: true,
      solitaire: { hideTimer: false },
    },
  );
});
