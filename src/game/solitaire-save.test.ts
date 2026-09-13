import assert from 'node:assert/strict';

import { parseSavedSolitaireGame, toSavedSolitaireGame } from './solitaire-save.ts';
import { newGame } from './solitaire.ts';

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok ${name}`);
}

test('parses a saved in-progress game', () => {
  const game = newGame(() => 0.5);
  const saved = parseSavedSolitaireGame({ game, elapsedMs: 12500 });
  assert.deepEqual(saved, { game, elapsedMs: 12500 });
});

test('clears selection and floors elapsed time when saving', () => {
  const game = newGame(() => 0.5);
  game.selected = { zone: 'waste' };
  const saved = toSavedSolitaireGame(game, 1250.9);
  assert.equal(saved.game.selected, null);
  assert.equal(saved.elapsedMs, 1250);
});

test('rejects missing fields, invalid elapsed time, and won games', () => {
  const game = newGame(() => 0.5);
  assert.equal(parseSavedSolitaireGame(null), null);
  assert.equal(parseSavedSolitaireGame({ game }), null);
  assert.equal(parseSavedSolitaireGame({ game, elapsedMs: -1 }), null);
  assert.equal(parseSavedSolitaireGame({ game, elapsedMs: 1.5 }), null);
  assert.equal(parseSavedSolitaireGame({ elapsedMs: 10, game: { ...game, tableau: [] } }), null);
  assert.equal(parseSavedSolitaireGame({ elapsedMs: 10, game: { ...game, won: true } }), null);
});
