export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type Suit = (typeof SUITS)[number];

export const TABLEAU_COUNT = 7;
export const FOUNDATION_COUNT = 4;

export type Card = {
  id: string;
  suit: Suit;
  rank: number;
  faceUp: boolean;
};

export type Selection =
  | { zone: 'waste' }
  | { zone: 'tableau'; pile: number; index: number }
  | { zone: 'foundation'; pile: number };

export type ClickTarget =
  | { zone: 'stock' }
  | { zone: 'waste' }
  | { zone: 'foundation'; pile: number }
  | { zone: 'tableau'; pile: number; index?: number };

export type GameState = {
  tableau: Card[][];
  foundations: Card[][];
  stock: Card[];
  waste: Card[];
  selected: Selection | null;
  won: boolean;
};

export const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUIT_LABELS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export function isRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function formatCard(card: Card): string {
  return `${RANK_LABELS[card.rank]}${SUIT_LABELS[card.suit]}`;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}-${rank}`, suit, rank, faceUp: false });
    }
  }
  return deck;
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function deal(deck: Card[]): GameState {
  const tableau: Card[][] = Array.from({ length: TABLEAU_COUNT }, () => []);
  let cursor = 0;
  for (let pile = 0; pile < TABLEAU_COUNT; pile++) {
    for (let n = 0; n <= pile; n++) {
      const card = deck[cursor++];
      tableau[pile].push({ ...card, faceUp: n === pile });
    }
  }

  // End of the array is the top of the stock, so the next leftover card is drawn first.
  const leftover = deck.slice(cursor).map((card) => ({ ...card, faceUp: false }));
  leftover.reverse();

  return {
    tableau,
    foundations: Array.from({ length: FOUNDATION_COUNT }, () => []),
    stock: leftover,
    waste: [],
    selected: null,
    won: false,
  };
}

export function newGame(rng: () => number = Math.random): GameState {
  return deal(shuffle(createDeck(), rng));
}

export function handleClick(state: GameState, target: ClickTarget): GameState {
  if (state.won) {
    return state;
  }

  if (target.zone === 'stock') {
    return drawFromStock(clearSelection(state));
  }

  if (target.zone === 'waste') {
    if (state.waste.length === 0) {
      return state;
    }
    if (state.selected?.zone === 'waste') {
      return clearSelection(state);
    }
    return select(state, { zone: 'waste' });
  }

  if (target.zone === 'foundation') {
    if (state.selected) {
      const moved = tryMoveToFoundation(state, target.pile);
      if (moved) {
        return moved;
      }
    }

    const pile = state.foundations[target.pile];
    if (pile.length === 0) {
      return state;
    }
    if (state.selected?.zone === 'foundation' && state.selected.pile === target.pile) {
      return clearSelection(state);
    }
    return select(state, { zone: 'foundation', pile: target.pile });
  }

  const pile = state.tableau[target.pile];
  const samePile = state.selected?.zone === 'tableau' && state.selected.pile === target.pile;

  if (state.selected && !samePile) {
    const moved = tryMoveToTableau(state, target.pile);
    if (moved) {
      return moved;
    }
  }

  if (pile.length === 0) {
    return state;
  }

  const index = target.index ?? pile.length - 1;
  const card = pile[index];
  if (!card?.faceUp || !isValidRun(pile.slice(index))) {
    return state;
  }

  const selected = state.selected;
  if (selected?.zone === 'tableau' && selected.pile === target.pile && selected.index === index) {
    return clearSelection(state);
  }

  return select(state, { zone: 'tableau', pile: target.pile, index });
}

export function isCardSelected(state: GameState, target: ClickTarget): boolean {
  if (!state.selected) {
    return false;
  }
  if (target.zone === 'waste') {
    return state.selected.zone === 'waste';
  }
  if (target.zone === 'foundation') {
    return state.selected.zone === 'foundation' && state.selected.pile === target.pile;
  }
  if (target.zone === 'tableau' && state.selected.zone === 'tableau' && state.selected.pile === target.pile) {
    const index = target.index ?? 0;
    return index >= state.selected.index;
  }
  return false;
}

export function isWon(state: GameState): boolean {
  return state.foundations.every((pile) => pile.length === 13);
}

function drawFromStock(state: GameState): GameState {
  const next = clone(state);
  if (next.stock.length > 0) {
    const card = next.stock.pop();
    if (card) {
      next.waste.push({ ...card, faceUp: true });
    }
    return next;
  }

  if (next.waste.length === 0) {
    return next;
  }

  next.stock = next.waste.map((card) => ({ ...card, faceUp: false })).reverse();
  next.waste = [];
  return next;
}

function tryMoveToTableau(state: GameState, pileIndex: number): GameState | null {
  const cards = getSelectedCards(state);
  if (cards.length === 0 || !isValidRun(cards)) {
    return null;
  }

  const target = state.tableau[pileIndex];
  if (!canPlaceOnTableau(cards[0], target)) {
    return null;
  }

  const next = removeSelected(state);
  next.tableau[pileIndex] = [...next.tableau[pileIndex], ...cards];
  next.won = isWon(next);
  return next;
}

function tryMoveToFoundation(state: GameState, pileIndex: number): GameState | null {
  const cards = getSelectedCards(state);
  if (cards.length !== 1) {
    return null;
  }

  if (!canPlaceOnFoundation(cards[0], state.foundations[pileIndex])) {
    return null;
  }

  const next = removeSelected(state);
  next.foundations[pileIndex] = [...next.foundations[pileIndex], cards[0]];
  next.won = isWon(next);
  return next;
}

export function canPlaceOnTableau(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) {
    return card.rank === 13;
  }
  const dest = pile[pile.length - 1];
  return dest.faceUp && isOppositeColor(dest, card) && card.rank === dest.rank - 1;
}

export function canPlaceOnFoundation(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) {
    return card.rank === 1;
  }
  const dest = pile[pile.length - 1];
  return dest.suit === card.suit && card.rank === dest.rank + 1;
}

function isOppositeColor(a: Card, b: Card): boolean {
  return isRed(a.suit) !== isRed(b.suit);
}

export function isValidRun(cards: Card[]): boolean {
  if (cards.length === 0 || cards.some((card) => !card.faceUp)) {
    return false;
  }
  for (let i = 0; i < cards.length - 1; i++) {
    if (!isOppositeColor(cards[i], cards[i + 1]) || cards[i + 1].rank !== cards[i].rank - 1) {
      return false;
    }
  }
  return true;
}

function getSelectedCards(state: GameState): Card[] {
  if (!state.selected) {
    return [];
  }
  if (state.selected.zone === 'waste') {
    const card = state.waste[state.waste.length - 1];
    return card ? [{ ...card }] : [];
  }
  if (state.selected.zone === 'foundation') {
    const pile = state.foundations[state.selected.pile];
    const card = pile[pile.length - 1];
    return card ? [{ ...card }] : [];
  }
  return state.tableau[state.selected.pile].slice(state.selected.index).map((card) => ({ ...card }));
}

function removeSelected(state: GameState): GameState {
  const next = clone(state);
  const selected = next.selected;
  if (!selected) {
    return next;
  }

  if (selected.zone === 'waste') {
    next.waste.pop();
  } else if (selected.zone === 'foundation') {
    next.foundations[selected.pile].pop();
  } else {
    const remaining = next.tableau[selected.pile].slice(0, selected.index);
    if (remaining.length > 0 && !remaining[remaining.length - 1].faceUp) {
      remaining[remaining.length - 1] = { ...remaining[remaining.length - 1], faceUp: true };
    }
    next.tableau[selected.pile] = remaining;
  }

  next.selected = null;
  return next;
}

function select(state: GameState, selected: Selection): GameState {
  const next = clone(state);
  next.selected = selected;
  return next;
}

function clearSelection(state: GameState): GameState {
  const next = clone(state);
  next.selected = null;
  return next;
}

function clone(state: GameState): GameState {
  return {
    tableau: state.tableau.map((pile) => pile.map((card) => ({ ...card }))),
    foundations: state.foundations.map((pile) => pile.map((card) => ({ ...card }))),
    stock: state.stock.map((card) => ({ ...card })),
    waste: state.waste.map((card) => ({ ...card })),
    selected: state.selected ? { ...state.selected } : null,
    won: state.won,
  };
}
