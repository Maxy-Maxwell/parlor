import { remove, retrieve, store } from '@/storage';

import {
  parseSavedSolitaireGame,
  SOLITAIRE_IN_PROGRESS_KEY,
  toSavedSolitaireGame,
  type SavedSolitaireGame,
} from './solitaire-save';
import type { GameState } from './solitaire';

export async function saveSolitaireInProgress(
  game: GameState,
  elapsedMs: number,
  dealId: string,
): Promise<void> {
  await store(SOLITAIRE_IN_PROGRESS_KEY, toSavedSolitaireGame(game, elapsedMs, dealId), 'local');
}

export async function loadSolitaireInProgress(): Promise<SavedSolitaireGame | null> {
  const data = await retrieve(SOLITAIRE_IN_PROGRESS_KEY, 'local');
  return parseSavedSolitaireGame(data);
}

export async function clearSolitaireInProgress(): Promise<void> {
  await remove(SOLITAIRE_IN_PROGRESS_KEY, 'local');
}
