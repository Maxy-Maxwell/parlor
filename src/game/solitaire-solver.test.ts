import assert from 'node:assert/strict';

import { applySolveStep, findSolution } from './solitaire-solver.ts';
import { createDeck, newGame, type Card, type GameState, isWon } from './solitaire.ts';

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
  };
}

test('finds a short foundation finish', () => {
  const game = blank();
  const suits = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
  for (const [index, suit] of suits.entries()) {
    game.foundations[index] = Array.from({ length: 12 }, (_, rank) => card(suit, rank + 1));
    game.tableau[index] = [card(suit, 13)];
  }

  const steps = findSolution(game);
  assert.ok(steps);
  assert.equal(steps.length, 4);

  let current = game;
  for (const step of steps) {
    current = applySolveStep(current, step);
  }
  assert.ok(isWon(current));
});

test('reports a buried card with no legal moves as unsolvable', () => {
  const game = blank();
  const deck = createDeck();
  const blocker = deck.find((item) => item.suit === 'hearts' && item.rank === 5);
  assert.ok(blocker);
  game.tableau[0] = [
    ...deck.filter((item) => item.id !== blocker.id).map((item) => ({ ...item, faceUp: false })),
    { ...blocker, faceUp: true },
  ];

  assert.equal(findSolution(game), null);
});

test('newGame deals a layout the solver can finish', () => {
  for (const seed of [0.11, 0.28, 0.44, 0.63, 0.81]) {
    const game = newGame(() => seed);
    const steps = findSolution(game);
    assert.ok(steps, `expected a solution for seed ${seed}`);

    let current = game;
    for (const step of steps) {
      current = applySolveStep(current, step);
    }
    assert.ok(isWon(current));
  }
});
