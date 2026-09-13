import { createStorage } from './create-storage';
import { localBackend } from './local';

const storage = createStorage({
  local: localBackend,
});

export const store = storage.store;
export const retrieve = storage.retrieve;
export const remove = storage.remove;

export type { JsonValue, StorageType } from './types';
