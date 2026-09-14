import {
  FOUNDATION_COUNT,
  TABLEAU_COUNT,
  canPlaceOnFoundation,
  canPlaceOnTableau,
  handleClick,
  isValidRun,
  type ClickTarget,
  type GameState,
} from './solitaire.ts';

export type SolveStep =
  | { type: 'draw' }
  | { type: 'move'; from: ClickTarget; to: ClickTarget };

const SEARCH_LIMIT = 80_000;
const MAX_PATH = 500;

export function findSolution(state: GameState): SolveStep[] | null {
  const start = deselect(state);
  if (start.won) {
    return [];
  }

  const greedy = playGreedy(start);
  if (greedy) {
    return greedy;
  }

  const path: SolveStep[] = [];
  const visited = new Set<string>();
  if (search(start, path, visited, 0)) {
    return [...path];
  }
  return null;
}

export function applySolveStep(state: GameState, step: SolveStep): GameState {
  const clear = deselect(state);
  if (step.type === 'draw') {
    return handleClick(clear, { zone: 'stock' });
  }
  return handleClick(handleClick(clear, step.from), step.to);
}

function playGreedy(start: GameState): SolveStep[] | null {
  const path: SolveStep[] = [];
  const visited = new Set<string>();
  let current = start;
  let idleDraws = 0;

  while (!current.won) {
    const key = stateKey(current);
    if (visited.has(key) || path.length >= MAX_PATH) {
      return null;
    }
    visited.add(key);

    const moves = orderedMoves(current);
    let step: SolveStep | null = null;
    let next: GameState | null = null;
    for (const candidate of moves) {
      const applied = applySolveStep(current, candidate);
      const nextKey = stateKey(applied);
      if (nextKey !== key && !visited.has(nextKey)) {
        step = candidate;
        next = applied;
        break;
      }
    }
    if (!step || !next) {
      return null;
    }

    path.push(step);
    idleDraws = step.type === 'draw' ? idleDraws + 1 : 0;
    if (idleDraws > current.stock.length + current.waste.length + 1) {
      return null;
    }
    current = next;
  }

  return path;
}

function search(
  state: GameState,
  path: SolveStep[],
  visited: Set<string>,
  idleDraws: number,
): boolean {
  if (state.won) {
    return true;
  }
  if (path.length >= MAX_PATH || visited.size >= SEARCH_LIMIT) {
    return false;
  }

  const key = stateKey(state);
  if (visited.has(key)) {
    return false;
  }
  visited.add(key);

  for (const step of orderedMoves(state)) {
    if (step.type === 'draw' && idleDraws > state.stock.length + state.waste.length + 1) {
      continue;
    }
    const next = applySolveStep(state, step);
    if (stateKey(next) === key) {
      continue;
    }
    path.push(step);
    if (search(next, path, visited, step.type === 'draw' ? idleDraws + 1 : 0)) {
      return true;
    }
    path.pop();
  }

  return false;
}

function orderedMoves(state: GameState): SolveStep[] {
  return generateMoves(state).sort((a, b) => scoreMove(state, b) - scoreMove(state, a));
}

function generateMoves(state: GameState): SolveStep[] {
  const moves: SolveStep[] = [];
  const firstEmpty = state.tableau.findIndex((pile) => pile.length === 0);

  const waste = state.waste[state.waste.length - 1];
  if (waste) {
    addFoundationMoves(moves, { zone: 'waste' }, waste, state);
    addTableauMoves(moves, { zone: 'waste' }, waste, state, firstEmpty, -1);
  }

  for (let pile = 0; pile < TABLEAU_COUNT; pile++) {
    const cards = state.tableau[pile];
    for (let index = 0; index < cards.length; index++) {
      if (!cards[index].faceUp) {
        continue;
      }
      const run = cards.slice(index);
      if (!isValidRun(run)) {
        continue;
      }
      const from: ClickTarget = { zone: 'tableau', pile, index };
      if (run.length === 1) {
        addFoundationMoves(moves, from, run[0], state);
      }
      addTableauMoves(moves, from, run[0], state, firstEmpty, pile);
    }
  }

  for (let pile = 0; pile < FOUNDATION_COUNT; pile++) {
    const cards = state.foundations[pile];
    const card = cards[cards.length - 1];
    if (!card) {
      continue;
    }
    addTableauMoves(moves, { zone: 'foundation', pile }, card, state, firstEmpty, -1);
  }

  if (state.stock.length > 0 || state.waste.length > 0) {
    moves.push({ type: 'draw' });
  }

  return moves;
}

function addFoundationMoves(
  moves: SolveStep[],
  from: ClickTarget,
  card: GameState['waste'][number],
  state: GameState,
) {
  for (let pile = 0; pile < FOUNDATION_COUNT; pile++) {
    if (canPlaceOnFoundation(card, state.foundations[pile])) {
      moves.push({ type: 'move', from, to: { zone: 'foundation', pile } });
    }
  }
}

function addTableauMoves(
  moves: SolveStep[],
  from: ClickTarget,
  card: GameState['waste'][number],
  state: GameState,
  firstEmpty: number,
  skipPile: number,
) {
  for (let pile = 0; pile < TABLEAU_COUNT; pile++) {
    if (pile === skipPile) {
      continue;
    }
    const dest = state.tableau[pile];
    if (dest.length === 0) {
      if (pile !== firstEmpty || card.rank !== 13) {
        continue;
      }
    }
    if (canPlaceOnTableau(card, dest)) {
      moves.push({ type: 'move', from, to: { zone: 'tableau', pile } });
    }
  }
}

function scoreMove(state: GameState, step: SolveStep): number {
  if (step.type === 'draw') {
    return 40;
  }
  if (step.to.zone === 'foundation') {
    return 100 + (revealsCard(state, step.from) ? 40 : 0);
  }
  if (step.from.zone === 'foundation') {
    return 1;
  }
  let score = 5;
  if (revealsCard(state, step.from)) {
    score += 50;
  }
  if (emptiesTableau(state, step.from)) {
    score += 10;
  }
  return score;
}

function revealsCard(state: GameState, from: ClickTarget): boolean {
  if (from.zone !== 'tableau' || from.index == null || from.index <= 0) {
    return false;
  }
  return !state.tableau[from.pile][from.index - 1]?.faceUp;
}

function emptiesTableau(state: GameState, from: ClickTarget): boolean {
  return from.zone === 'tableau' && from.index === 0;
}

function deselect(state: GameState): GameState {
  if (!state.selected) {
    return state;
  }
  if (state.selected.zone === 'waste') {
    return handleClick(state, { zone: 'waste' });
  }
  if (state.selected.zone === 'foundation') {
    return handleClick(state, { zone: 'foundation', pile: state.selected.pile });
  }
  return handleClick(state, {
    zone: 'tableau',
    pile: state.selected.pile,
    index: state.selected.index,
  });
}

function stateKey(state: GameState): string {
  const pile = (cards: GameState['stock']) =>
    cards.map((card) => `${card.id}:${card.faceUp ? '1' : '0'}`).join(',');
  return [
    String(state.drawCount),
    state.tableau.map(pile).join('|'),
    state.foundations.map(pile).join('|'),
    pile(state.stock),
    pile(state.waste),
  ].join('/');
}
