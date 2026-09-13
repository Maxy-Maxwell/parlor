import assert from 'node:assert/strict';

import { createStorage } from './create-storage.ts';
import type { StorageBackend } from './types.ts';

function memoryBackend(): StorageBackend {
  const map = new Map<string, string>();
  return {
    async getItem(key) {
      return map.get(key) ?? null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}

function testStorage() {
  return createStorage({ local: memoryBackend() });
}

async function test(name: string, fn: () => Promise<void>) {
  await fn();
  console.log(`ok ${name}`);
}

await test('store then retrieve returns the same object', async () => {
  const storage = testStorage();
  const data = { pile: [1, 2, 3], won: false };
  await storage.store('solitaire:in-progress', data, 'local');
  assert.deepEqual(await storage.retrieve('solitaire:in-progress', 'local'), data);
});

await test('retrieve missing key returns null', async () => {
  const storage = testStorage();
  assert.equal(await storage.retrieve('missing', 'local'), null);
});

await test('store overwrites data for the same key', async () => {
  const storage = testStorage();
  await storage.store('stats', { wins: 1 }, 'local');
  await storage.store('stats', { wins: 2, losses: 1 }, 'local');
  assert.deepEqual(await storage.retrieve('stats', 'local'), { wins: 2, losses: 1 });
});

await test('keys are independent', async () => {
  const storage = testStorage();
  await storage.store('game-a', { id: 'a' }, 'local');
  await storage.store('game-b', { id: 'b' }, 'local');
  assert.deepEqual(await storage.retrieve('game-a', 'local'), { id: 'a' });
  assert.deepEqual(await storage.retrieve('game-b', 'local'), { id: 'b' });
});

await test('empty key is rejected', async () => {
  const storage = testStorage();
  await assert.rejects(() => storage.store('', { ok: true }, 'local'));
  await assert.rejects(() => storage.retrieve('   ', 'local'));
});

await test('remove deletes stored data', async () => {
  const storage = testStorage();
  await storage.store('solitaire:in-progress', { won: false }, 'local');
  await storage.remove('solitaire:in-progress', 'local');
  assert.equal(await storage.retrieve('solitaire:in-progress', 'local'), null);
});
