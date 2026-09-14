import { retrieve, store } from '@/storage';

import {
  applyIncomplete,
  applyWin,
  EMPTY_USER_STATS,
  parseUserStats,
  type UserStats,
} from './user-stats';

export const USER_STATS_KEY = 'user:stats';

export async function loadUserStats(): Promise<UserStats> {
  const data = await retrieve(USER_STATS_KEY, 'local');
  return parseUserStats(data);
}

export async function recordSolitaireWin(dealId: string, elapsedMs: number): Promise<UserStats> {
  const next = applyWin(await loadUserStats(), elapsedMs, dealId);
  await store(USER_STATS_KEY, next, 'local');
  return next;
}

export async function recordIncompleteGame(elapsedMs: number): Promise<UserStats> {
  const current = await loadUserStats();
  const next = applyIncomplete(current, elapsedMs);
  if (next === current) {
    return current;
  }
  await store(USER_STATS_KEY, next, 'local');
  return next;
}

export async function resetUserStats(): Promise<UserStats> {
  const next = { ...EMPTY_USER_STATS };
  await store(USER_STATS_KEY, next, 'local');
  return next;
}
