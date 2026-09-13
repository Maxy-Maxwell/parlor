import assert from 'node:assert/strict';

import {
  getCountAutoSolveWins,
  setCountAutoSolveWins,
  shouldRecordAutoSolveWin,
} from './flags.ts';

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok ${name}`);
}

test('the auto-solve stats flag can be toggled', () => {
  setCountAutoSolveWins(true);
  assert.equal(getCountAutoSolveWins(), true);
  setCountAutoSolveWins(false);
  assert.equal(getCountAutoSolveWins(), false);
});

test('auto-solve wins stay out of stats unless debug and the flag are on', () => {
  assert.equal(shouldRecordAutoSolveWin(false, false), false);
  assert.equal(shouldRecordAutoSolveWin(true, false), false);
  assert.equal(shouldRecordAutoSolveWin(false, true), false);
  assert.equal(shouldRecordAutoSolveWin(true, true), true);
});
