import type { JsonValue, StorageBackend, StorageType } from './types';

const KEY_PREFIX = 'parlor';

function namespacedKey(type: StorageType, key: string): string {
  return `${KEY_PREFIX}:${type}:${key}`;
}

function assertKey(key: string): void {
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new Error('Storage key must be a non-empty string');
  }
}

function serialize(data: unknown): string {
  const value = JSON.stringify(data);
  if (typeof value !== 'string') {
    throw new Error('Storage data must be JSON-serializable');
  }
  return value;
}

export function createStorage(backends: Record<StorageType, StorageBackend>) {
  function backendFor(type: StorageType): StorageBackend {
    const backend = backends[type];
    if (!backend) {
      throw new Error(`Unsupported storage type: ${String(type)}`);
    }
    return backend;
  }

  async function store(key: string, data: unknown, type: StorageType): Promise<void> {
    assertKey(key);
    await backendFor(type).setItem(namespacedKey(type, key), serialize(data));
  }

  async function retrieve<T extends JsonValue = JsonValue>(
    key: string,
    type: StorageType,
  ): Promise<T | null> {
    assertKey(key);
    const raw = await backendFor(type).getItem(namespacedKey(type, key));
    if (raw == null) {
      return null;
    }
    return JSON.parse(raw) as T;
  }

  async function remove(key: string, type: StorageType): Promise<void> {
    assertKey(key);
    await backendFor(type).removeItem(namespacedKey(type, key));
  }

  return { store, retrieve, remove };
}
