import assert from 'node:assert/strict';

import { applySolveStep, findSolution } from './solitaire-solver.ts';
import { SUITS, createDeck, deal, type Card, type GameState, isWon } from './solitaire.ts';

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

test('finds a solution for a known-winnable starting layout', () => {
  const game = deal(solvableDeck());
  const steps = findSolution(game);
  assert.ok(steps);

  let current = game;
  for (const step of steps) {
    current = applySolveStep(current, step);
  }
  assert.ok(isWon(current));
});

function solvableDeck(): Card[] {
  const stock: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 6; rank++) {
      stock.push(card(suit, rank, false));
    }
  }

  const piles = [
    descendingPile(SUITS[1], 7, 7),
    descendingPile(SUITS[2], 8, 7),
    descendingPile(SUITS[3], 9, 7),
    descendingPile(SUITS[3], 13, 10),
    descendingPile(SUITS[2], 13, 9),
    descendingPile(SUITS[1], 13, 8),
    descendingPile(SUITS[0], 13, 7),
  ];

  return [...piles.flat(), ...stock];
}

function descendingPile(suit: Card['suit'], bottomRank: number, topRank: number): Card[] {
  const cards: Card[] = [];
  for (let rank = bottomRank; rank >= topRank; rank--) {
    cards.push(card(suit, rank, false));
  }
  return cards;
}
