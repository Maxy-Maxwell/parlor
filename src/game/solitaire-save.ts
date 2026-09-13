import {
  FOUNDATION_COUNT,
  SUITS,
  TABLEAU_COUNT,
  type Card,
  type GameState,
  type Selection,
  type Suit,
} from './solitaire.ts';

export const SOLITAIRE_IN_PROGRESS_KEY = 'solitaire:in-progress';

export type SavedSolitaireGame = {
  game: GameState;
  elapsedMs: number;
  dealId: string;
};

export function createDealId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `deal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function toSavedSolitaireGame(
  game: GameState,
  elapsedMs: number,
  dealId = '',
): SavedSolitaireGame {
  return {
    game: { ...game, selected: null },
    elapsedMs: Math.max(0, Math.floor(elapsedMs)),
    dealId,
  };
}

export function parseSavedSolitaireGame(data: unknown): SavedSolitaireGame | null {
  if (!isRecord(data) || !isNonNegativeInt(data.elapsedMs) || !isGameState(data.game)) {
    return null;
  }
  if (data.game.won) {
    return null;
  }
  return {
    game: data.game,
    elapsedMs: data.elapsedMs,
    dealId: typeof data.dealId === 'string' ? data.dealId : '',
  };
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || typeof value.won !== 'boolean') {
    return false;
  }
  if (!isCardGrid(value.tableau, TABLEAU_COUNT) || !isCardGrid(value.foundations, FOUNDATION_COUNT)) {
    return false;
  }
  if (!isCardList(value.stock) || !isCardList(value.waste)) {
    return false;
  }
  if (value.selected !== null && !isSelection(value.selected)) {
    return false;
  }
  return true;
}

function isSelection(value: unknown): value is Selection {
  if (!isRecord(value) || typeof value.zone !== 'string') {
    return false;
  }
  if (value.zone === 'waste') {
    return true;
  }
  if (value.zone === 'foundation') {
    return isPileIndex(value.pile, FOUNDATION_COUNT);
  }
  if (value.zone === 'tableau') {
    return isPileIndex(value.pile, TABLEAU_COUNT) && isNonNegativeInt(value.index);
  }
  return false;
}

function isCardGrid(value: unknown, count: number): value is Card[][] {
  return Array.isArray(value) && value.length === count && value.every(isCardList);
}

function isCardList(value: unknown): value is Card[] {
  return Array.isArray(value) && value.every(isCard);
}

function isCard(value: unknown): value is Card {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    isSuit(value.suit) &&
    isRank(value.rank) &&
    typeof value.faceUp === 'boolean'
  );
}

function isSuit(value: unknown): value is Suit {
  return typeof value === 'string' && (SUITS as readonly string[]).includes(value);
}

function isRank(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 13;
}

function isPileIndex(value: unknown, count: number): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < count;
}

function isNonNegativeInt(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
