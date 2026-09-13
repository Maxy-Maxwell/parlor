export const STORAGE_TYPES = ['local'] as const;

/** Where data is written. `local` survives app close on device and web. */
export type StorageType = (typeof STORAGE_TYPES)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type StorageBackend = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
