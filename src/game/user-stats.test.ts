import assert from 'node:assert/strict';

import {
  applyIncomplete,
  applyWin,
  averageWonMs,
  EMPTY_USER_STATS,
  EMPTY_VARIANT_STATS,
  MIN_STATS_GAME_MS,
  parseUserStats,
  statsForDraws,
  winRatePercent,
} from './user-stats.ts';

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok ${name}`);
}

test('win updates count, total time, and fastest time', () => {
  const first = applyWin(EMPTY_USER_STATS, 12000, 'deal-a');
  assert.equal(first.byDraw[1].gamesWon, 1);
  assert.equal(first.byDraw[1].totalWonMs, 12000);
  assert.equal(first.byDraw[1].fastestWonMs, 12000);
  assert.equal(averageWonMs(first.byDraw[1]), 12000);
  assert.equal(first.byDraw[3].gamesWon, 0);

  const second = applyWin(first, 8000, 'deal-b');
  assert.equal(second.byDraw[1].gamesWon, 2);
  assert.equal(second.byDraw[1].totalWonMs, 20000);
  assert.equal(second.byDraw[1].fastestWonMs, 8000);
  assert.equal(averageWonMs(second.byDraw[1]), 10000);
});

test('wins for one-card and three-card games are tracked separately', () => {
  const one = applyWin(EMPTY_USER_STATS, 12000, 'deal-a', 1);
  const both = applyWin(one, 4000, 'deal-b', 3);
  assert.equal(both.byDraw[1].gamesWon, 1);
  assert.equal(both.byDraw[3].gamesWon, 1);
  assert.equal(both.byDraw[3].fastestWonMs, 4000);

  const combined = statsForDraws(both, [1, 3]);
  assert.equal(combined.gamesWon, 2);
  assert.equal(combined.totalWonMs, 16000);
  assert.equal(combined.fastestWonMs, 4000);
  assert.deepEqual(statsForDraws(both, [3]), both.byDraw[3]);
});

test('the same deal is not counted as a win twice', () => {
  const once = applyWin(EMPTY_USER_STATS, 5000, 'deal-a');
  const twice = applyWin(once, 5000, 'deal-a');
  assert.deepEqual(twice, once);
});

test('incomplete games are tracked in the win rate', () => {
  const won = applyWin(EMPTY_USER_STATS, 10000, 'deal-a');
  const mixed = applyIncomplete(applyIncomplete(won, MIN_STATS_GAME_MS, 1, true), MIN_STATS_GAME_MS, 1, false);
  assert.equal(mixed.byDraw[1].gamesWon, 1);
  assert.equal(mixed.byDraw[1].gamesNotCompleted, 2);
  assert.equal(mixed.byDraw[1].gamesNotCompletedSolvable, 1);
  assert.equal(mixed.byDraw[1].gamesNotCompletedImpossible, 1);
  assert.equal(Math.round(winRatePercent(mixed.byDraw[1]) ?? 0), 33);
  assert.equal(winRatePercent(EMPTY_VARIANT_STATS), null);
});

test('incomplete games are flagged as solvable or impossible', () => {
  const solvable = applyIncomplete(EMPTY_USER_STATS, MIN_STATS_GAME_MS, 1, true);
  assert.equal(solvable.byDraw[1].gamesNotCompletedSolvable, 1);
  assert.equal(solvable.byDraw[1].gamesNotCompletedImpossible, 0);

  const mixed = applyIncomplete(solvable, MIN_STATS_GAME_MS, 1, false);
  assert.equal(mixed.byDraw[1].gamesNotCompleted, 2);
  assert.equal(mixed.byDraw[1].gamesNotCompletedSolvable, 1);
  assert.equal(mixed.byDraw[1].gamesNotCompletedImpossible, 1);

  const combined = statsForDraws(
    applyIncomplete(mixed, MIN_STATS_GAME_MS, 3, false),
    [1, 3],
  );
  assert.equal(combined.gamesNotCompletedSolvable, 1);
  assert.equal(combined.gamesNotCompletedImpossible, 2);
});

test('incomplete games under 15 seconds are omitted from the tally', () => {
  const skipped = applyIncomplete(EMPTY_USER_STATS, MIN_STATS_GAME_MS - 1, 1, true);
  assert.deepEqual(skipped, EMPTY_USER_STATS);

  const counted = applyIncomplete(EMPTY_USER_STATS, MIN_STATS_GAME_MS, 1, true);
  assert.equal(counted.byDraw[1].gamesNotCompleted, 1);
  assert.equal(counted.byDraw[1].gamesNotCompletedSolvable, 1);
  assert.equal(counted.byDraw[3].gamesNotCompleted, 0);

  const mixed = applyIncomplete(applyIncomplete(EMPTY_USER_STATS, 5_000, 3, false), 20_000, 3, false);
  assert.equal(mixed.byDraw[3].gamesNotCompleted, 1);
  assert.equal(mixed.byDraw[3].gamesNotCompletedImpossible, 1);
  assert.equal(mixed.byDraw[1].gamesNotCompleted, 0);
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
      byDraw: {
        1: {
          gamesWon: 2,
          gamesNotCompleted: 1,
          gamesNotCompletedSolvable: 1,
          gamesNotCompletedImpossible: 0,
          totalWonMs: 9000,
          fastestWonMs: 3000,
          lastWinDealId: 'deal-a',
        },
        3: EMPTY_VARIANT_STATS,
      },
    },
  );
  assert.deepEqual(
    parseUserStats({
      byDraw: {
        1: {
          gamesWon: 1,
          gamesNotCompleted: 0,
          gamesNotCompletedSolvable: 2,
          gamesNotCompletedImpossible: 3,
          totalWonMs: 5000,
          fastestWonMs: 5000,
          lastWinDealId: 'one',
        },
        3: {
          gamesWon: 4,
          gamesNotCompleted: 2,
          totalWonMs: 40000,
          fastestWonMs: 8000,
          lastWinDealId: 'three',
        },
      },
    }),
    {
      byDraw: {
        1: {
          gamesWon: 1,
          gamesNotCompleted: 5,
          gamesNotCompletedSolvable: 2,
          gamesNotCompletedImpossible: 3,
          totalWonMs: 5000,
          fastestWonMs: 5000,
          lastWinDealId: 'one',
        },
        3: {
          gamesWon: 4,
          gamesNotCompleted: 2,
          gamesNotCompletedSolvable: 2,
          gamesNotCompletedImpossible: 0,
          totalWonMs: 40000,
          fastestWonMs: 8000,
          lastWinDealId: 'three',
        },
      },
    },
  );
});
