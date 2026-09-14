import { retrieve, store } from '@/storage';

import type { DrawCount, GameState } from './solitaire';
import { findSolution } from './solitaire-solver';
import {
  applyIncomplete,
  applyWin,
  emptyUserStats,
  MIN_STATS_GAME_MS,
  parseUserStats,
  type UserStats,
} from './user-stats';

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
  drawCount: DrawCount,
  game: GameState,
  knownSolvable?: boolean,
): Promise<UserStats> {
  const current = await loadUserStats();
  const time = Math.max(0, Math.floor(elapsedMs));
  if (time < MIN_STATS_GAME_MS) {
    return current;
  }

  const solvable = knownSolvable ?? findSolution(game) != null;
  const next = applyIncomplete(current, elapsedMs, drawCount, solvable);
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
