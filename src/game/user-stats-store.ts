import { retrieve, store } from '@/storage';

import {
  applyIncomplete,
  applyWin,
  emptyUserStats,
  parseUserStats,
  type UserStats,
} from './user-stats';
import type { DrawCount } from './solitaire';

export const USER_STATS_KEY = 'user:stats';

export async function loadUserStats(): Promise<UserStats> {
  const data = await retrieve(USER_STATS_KEY, 'local');
  return parseUserStats(data);
}

export async function recordSolitaireWin(
  dealId: string,
  elapsedMs: number,
  drawCount: DrawCount = 1,
): Promise<UserStats> {
  const next = applyWin(await loadUserStats(), elapsedMs, dealId, drawCount);
  await store(USER_STATS_KEY, next, 'local');
  return next;
}

export async function recordIncompleteGame(
  elapsedMs: number,
  drawCount: DrawCount = 1,
): Promise<UserStats> {
  const current = await loadUserStats();
  const next = applyIncomplete(current, elapsedMs, drawCount);
  if (next === current) {
    return current;
  }
  await store(USER_STATS_KEY, next, 'local');
  return next;
}

export async function resetUserStats(): Promise<UserStats> {
  const next = emptyUserStats();
  await store(USER_STATS_KEY, next, 'local');
  return next;
}
