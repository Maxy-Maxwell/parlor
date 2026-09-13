import assert from 'node:assert/strict';

import {
  applyIncomplete,
  applyWin,
  averageWonMs,
  EMPTY_USER_STATS,
  parseUserStats,
  winRatePercent,
} from './user-stats.ts';

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok ${name}`);
}

test('win updates count, total time, and fastest time', () => {
  const first = applyWin(EMPTY_USER_STATS, 12000, 'deal-a');
  assert.equal(first.gamesWon, 1);
  assert.equal(first.totalWonMs, 12000);
  assert.equal(first.fastestWonMs, 12000);
  assert.equal(averageWonMs(first), 12000);

  const second = applyWin(first, 8000, 'deal-b');
  assert.equal(second.gamesWon, 2);
  assert.equal(second.totalWonMs, 20000);
  assert.equal(second.fastestWonMs, 8000);
  assert.equal(averageWonMs(second), 10000);
});

test('the same deal is not counted as a win twice', () => {
  const once = applyWin(EMPTY_USER_STATS, 5000, 'deal-a');
  const twice = applyWin(once, 5000, 'deal-a');
  assert.deepEqual(twice, once);
});

test('incomplete games are tracked in the win rate', () => {
  const won = applyWin(EMPTY_USER_STATS, 10000, 'deal-a');
  const mixed = applyIncomplete(applyIncomplete(won));
  assert.equal(mixed.gamesWon, 1);
  assert.equal(mixed.gamesNotCompleted, 2);
  assert.equal(Math.round(winRatePercent(mixed) ?? 0), 33);
  assert.equal(winRatePercent(EMPTY_USER_STATS), null);
});

test('parseUserStats falls back to empty stats for invalid payloads', () => {
  assert.deepEqual(parseUserStats(null), EMPTY_USER_STATS);
  assert.deepEqual(parseUserStats({ gamesWon: -1 }), EMPTY_USER_STATS);
  assert.deepEqual(
    parseUserStats({
      gamesWon: 2,
      gamesNotCompleted: 1,
      totalWonMs: 9000,
      fastestWonMs: 3000,
      lastWinDealId: 'deal-a',
    }),
    {
      gamesWon: 2,
      gamesNotCompleted: 1,
      totalWonMs: 9000,
      fastestWonMs: 3000,
      lastWinDealId: 'deal-a',
    },
  );
});
