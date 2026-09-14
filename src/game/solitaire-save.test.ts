import assert from 'node:assert/strict';

import { parseSavedSolitaireGame, toSavedSolitaireGame } from './solitaire-save.ts';
import { newGame } from './solitaire.ts';

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok ${name}`);
}

test('parses a saved in-progress game', () => {
  const game = newGame(() => 0.5);
  const saved = parseSavedSolitaireGame({ game, elapsedMs: 12500, dealId: 'deal-a' });
  assert.deepEqual(saved, { game, elapsedMs: 12500, dealId: 'deal-a' });
});

test('clears selection and floors elapsed time when saving', () => {
  const game = newGame(() => 0.5);
  game.selected = { zone: 'waste' };
  const saved = toSavedSolitaireGame(game, 1250.9, 'deal-a');
  assert.equal(saved.game.selected, null);
  assert.equal(saved.elapsedMs, 1250);
  assert.equal(saved.dealId, 'deal-a');
});

test('rejects missing fields, invalid elapsed time, and won games', () => {
  const game = newGame(() => 0.5);
  assert.equal(parseSavedSolitaireGame(null), null);
  assert.equal(parseSavedSolitaireGame({ game }), null);
  assert.equal(parseSavedSolitaireGame({ game, elapsedMs: -1 }), null);
  assert.equal(parseSavedSolitaireGame({ game, elapsedMs: 1.5 }), null);
  assert.equal(parseSavedSolitaireGame({ elapsedMs: 10, game: { ...game, tableau: [] } }), null);
  assert.equal(parseSavedSolitaireGame({ elapsedMs: 10, game: { ...game, won: true } }), null);
  assert.equal(parseSavedSolitaireGame({ elapsedMs: 10, game: { ...game, drawCount: 2 } }), null);
});

test('keeps a three-card draw and defaults older saves to one-card', () => {
  const three = newGame(() => 0.5, 3);
  const savedThree = parseSavedSolitaireGame({ game: three, elapsedMs: 8000, dealId: 'deal-3' });
  assert.equal(savedThree?.game.drawCount, 3);

  const legacyGame = newGame(() => 0.5);
  const { drawCount, ...legacy } = legacyGame;
  void drawCount;
  const savedLegacy = parseSavedSolitaireGame({ game: legacy, elapsedMs: 8000, dealId: 'deal-1' });
  assert.equal(savedLegacy?.game.drawCount, 1);
});
