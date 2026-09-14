import assert from 'node:assert/strict';

import {
  createDeck,
  deal,
  formatCard,
  handleClick,
  isCardSelected,
  isWon,
  newGame,
  type Card,
  type GameState,
} from './solitaire.ts';

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok ${name}`);
}

function card(suit: Card['suit'], rank: number, faceUp = true): Card {
  return { id: `${suit}-${rank}`, suit, rank, faceUp };
}

function blank(): GameState {
  return {
    tableau: [[], [], [], [], [], [], []],
    foundations: [[], [], [], []],
    stock: [],
    waste: [],
    selected: null,
    won: false,
    drawCount: 1,
  };
}

test('deal uses 52 unique cards with solitaire pile sizes', () => {
  const game = deal(createDeck());
  const tableauCount = game.tableau.reduce((sum, pile) => sum + pile.length, 0);
  assert.equal(tableauCount, 28);
  assert.deepEqual(
    game.tableau.map((pile) => pile.length),
    [1, 2, 3, 4, 5, 6, 7],
  );
  for (const [index, pile] of game.tableau.entries()) {
    pile.forEach((item, cardIndex) => {
      assert.equal(item.faceUp, cardIndex === index);
    });
  }
  assert.equal(game.stock.length, 24);
  assert.equal(game.waste.length, 0);
  assert.equal(game.drawCount, 1);
  assert.ok(game.stock.every((item) => !item.faceUp));
});

test('first stock click draws the first leftover card', () => {
  const deck = createDeck();
  const leftoverFirst = deck[28];
  let game = deal(deck);
  game = handleClick(game, { zone: 'stock' });
  assert.equal(game.stock.length, 23);
  assert.equal(game.waste.length, 1);
  assert.equal(game.waste[0].id, leftoverFirst.id);
  assert.equal(game.waste[0].faceUp, true);
});

test('empty stock recycles waste in original draw order', () => {
  let game = blank();
  game.waste = [card('spades', 1), card('hearts', 2), card('clubs', 3)];
  game = handleClick(game, { zone: 'stock' });
  assert.equal(game.waste.length, 0);
  assert.deepEqual(
    game.stock.map((item) => item.id),
    ['clubs-3', 'hearts-2', 'spades-1'],
  );
  assert.ok(game.stock.every((item) => !item.faceUp));
  game = handleClick(game, { zone: 'stock' });
  assert.equal(game.waste[0].id, 'spades-1');
});

test('draw-three stock click moves up to three cards onto the waste', () => {
  const deck = createDeck();
  let game = deal(deck, 3);
  assert.equal(game.drawCount, 3);
  game = handleClick(game, { zone: 'stock' });
  assert.equal(game.stock.length, 21);
  assert.equal(game.waste.length, 3);
  assert.deepEqual(
    game.waste.map((item) => item.id),
    [deck[28].id, deck[29].id, deck[30].id],
  );
  assert.ok(game.waste.every((item) => item.faceUp));
});

test('draw-three takes the remaining stock when fewer than three cards are left', () => {
  let game = blank();
  game.drawCount = 3;
  game.stock = [card('spades', 1, false), card('hearts', 2, false)];
  game = handleClick(game, { zone: 'stock' });
  assert.equal(game.stock.length, 0);
  assert.deepEqual(
    game.waste.map((item) => item.id),
    ['hearts-2', 'spades-1'],
  );
});

test('waste card can be placed on an opposite-color rank-one-higher tableau card', () => {
  let game = blank();
  game.waste = [card('hearts', 12)];
  game.tableau[0] = [card('spades', 13)];
  game = handleClick(game, { zone: 'waste' });
  game = handleClick(game, { zone: 'tableau', pile: 0, index: 0 });
  assert.equal(game.waste.length, 0);
  assert.equal(game.tableau[0].map(formatCard).join(' '), 'K♠ Q♥');
  assert.equal(game.selected, null);
});

test('rejects same-color and non-adjacent tableau builds', () => {
  let game = blank();
  game.waste = [card('clubs', 12)];
  game.tableau[0] = [card('spades', 13)];
  game = handleClick(game, { zone: 'waste' });
  const afterInvalid = handleClick(game, { zone: 'tableau', pile: 0, index: 0 });
  assert.equal(afterInvalid.waste.length, 1);
  assert.equal(afterInvalid.tableau[0].length, 1);

  game.waste = [card('hearts', 10)];
  game.selected = { zone: 'waste' };
  const afterSkip = handleClick(game, { zone: 'tableau', pile: 0, index: 0 });
  assert.equal(afterSkip.waste.length, 1);
});

test('only a king can move onto an empty tableau pile', () => {
  let game = blank();
  game.waste = [card('hearts', 12)];
  game = handleClick(game, { zone: 'waste' });
  game = handleClick(game, { zone: 'tableau', pile: 3 });
  assert.equal(game.waste.length, 1);

  game = blank();
  game.waste = [card('hearts', 13)];
  game = handleClick(game, { zone: 'waste' });
  game = handleClick(game, { zone: 'tableau', pile: 3 });
  assert.equal(game.tableau[3][0].rank, 13);
  assert.equal(game.waste.length, 0);
});

test('moving a tableau card flips the card beneath it', () => {
  let game = blank();
  game.tableau[0] = [card('spades', 8, false), card('hearts', 7)];
  game.tableau[1] = [card('clubs', 8)];
  game = handleClick(game, { zone: 'tableau', pile: 0, index: 1 });
  game = handleClick(game, { zone: 'tableau', pile: 1, index: 0 });
  assert.equal(game.tableau[0].length, 1);
  assert.equal(game.tableau[0][0].faceUp, true);
  assert.equal(game.tableau[1].map(formatCard).join(' '), '8♣ 7♥');
});

test('a descending alternating run moves together', () => {
  let game = blank();
  game.tableau[0] = [card('diamonds', 13)];
  game.tableau[1] = [card('spades', 12), card('hearts', 11)];
  game = handleClick(game, { zone: 'tableau', pile: 1, index: 0 });
  assert.equal(isCardSelected(game, { zone: 'tableau', pile: 1, index: 1 }), true);
  game = handleClick(game, { zone: 'tableau', pile: 0, index: 0 });
  assert.equal(game.tableau[1].length, 0);
  assert.equal(game.tableau[0].map(formatCard).join(' '), 'K♦ Q♠ J♥');
});

test('foundations build up by suit from ace', () => {
  let game = blank();
  game.waste = [card('spades', 2)];
  game = handleClick(game, { zone: 'waste' });
  game = handleClick(game, { zone: 'foundation', pile: 0 });
  assert.equal(game.waste.length, 1);

  game = blank();
  game.waste = [card('spades', 1)];
  game = handleClick(game, { zone: 'waste' });
  game = handleClick(game, { zone: 'foundation', pile: 0 });
  assert.equal(game.foundations[0][0].rank, 1);

  game.waste = [card('spades', 2)];
  game.selected = null;
  game = handleClick(game, { zone: 'waste' });
  game = handleClick(game, { zone: 'foundation', pile: 0 });
  assert.equal(game.foundations[0].map((item) => item.rank).join(','), '1,2');
});

test('only a single card can move to a foundation', () => {
  let game = blank();
  game.foundations[0] = [card('spades', 1)];
  game.tableau[0] = [card('hearts', 3), card('spades', 2)];
  game = handleClick(game, { zone: 'tableau', pile: 0, index: 0 });
  game = handleClick(game, { zone: 'foundation', pile: 0 });
  assert.equal(game.foundations[0].length, 1);
  assert.equal(game.tableau[0].length, 2);
});

test('clicking the selected card deselects it', () => {
  let game = blank();
  game.waste = [card('clubs', 4)];
  game = handleClick(game, { zone: 'waste' });
  assert.deepEqual(game.selected, { zone: 'waste' });
  game = handleClick(game, { zone: 'waste' });
  assert.equal(game.selected, null);
});

test('face-down tableau cards cannot be selected', () => {
  let game = blank();
  game.tableau[0] = [card('spades', 10, false), card('hearts', 5)];
  const next = handleClick(game, { zone: 'tableau', pile: 0, index: 0 });
  assert.equal(next.selected, null);
});

test('filling all foundations marks the game won and freezes clicks', () => {
  let game = blank();
  game.foundations = [
    createDeck().filter((item) => item.suit === 'spades').map((item) => ({ ...item, faceUp: true })),
    createDeck().filter((item) => item.suit === 'hearts').map((item) => ({ ...item, faceUp: true })),
    createDeck().filter((item) => item.suit === 'diamonds').map((item) => ({ ...item, faceUp: true })),
    createDeck()
      .filter((item) => item.suit === 'clubs' && item.rank < 13)
      .map((item) => ({ ...item, faceUp: true })),
  ];
  game.waste = [card('clubs', 13)];
  assert.equal(isWon(game), false);
  game = handleClick(game, { zone: 'waste' });
  game = handleClick(game, { zone: 'foundation', pile: 3 });
  assert.equal(game.won, true);
  assert.equal(game.foundations[3].length, 13);
  const frozen = handleClick(game, { zone: 'stock' });
  assert.equal(frozen.stock.length, 0);
});

test('newGame shuffles rather than using deck order', () => {
  const ordered = deal(createDeck());
  const random = newGame(() => 0.42);
  const orderedIds = ordered.tableau.flat().map((item) => item.id);
  const randomIds = random.tableau.flat().map((item) => item.id);
  assert.notDeepEqual(orderedIds, randomIds);
});

test('newGame deals every card once in a standard solitaire layout', () => {
  const game = newGame(() => 0.37);
  const cards = [
    ...game.tableau.flat(),
    ...game.foundations.flat(),
    ...game.stock,
    ...game.waste,
  ];
  assert.equal(cards.length, 52);
  assert.equal(new Set(cards.map((item) => item.id)).size, 52);
  assert.deepEqual(
    game.tableau.map((pile) => pile.length),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(game.stock.length, 24);
  assert.equal(game.drawCount, 1);
});

test('newGame can deal a three-card draw game', () => {
  const game = newGame(() => 0.37, 3);
  assert.equal(game.drawCount, 3);
  assert.equal(game.stock.length, 24);
});

test('newGame shuffles the full deck instead of stacking a solvable layout', () => {
  const games = [0.11, 0.28, 0.44, 0.63, 0.81].map((seed) => newGame(() => seed));
  assert.ok(games.some((game) => game.stock.some((item) => item.rank > 6)));
});

console.log('all tests passed');
