import {
  FOUNDATION_COUNT,
  TABLEAU_COUNT,
  canPlaceOnFoundation,
  canPlaceOnTableau,
  handleClick,
  isValidRun,
  type Card,
  type ClickTarget,
  type GameState,
} from './solitaire.ts';

export type SolveStep =
  | { type: 'draw' }
  | { type: 'move'; from: ClickTarget; to: ClickTarget };

const SEARCH_LIMIT = 40_000;
const MAX_PATH = 500;
const MAX_FRONTIER = 8_000;

export function findSolution(state: GameState): SolveStep[] | null {
  const start = deselect(state);
  if (start.won) {
    return [];
  }

  const greedy = playGreedy(start);
  if (greedy) {
    return greedy;
  }

  return searchBestFirst(start);
}

export function applySolveStep(state: GameState, step: SolveStep): GameState {
  const clear = deselect(state);
  if (step.type === 'draw') {
    return handleClick(clear, { zone: 'stock' });
  }
  return handleClick(handleClick(clear, step.from), step.to);
}

function playGreedy(start: GameState): SolveStep[] | null {
  const opened = autoplay(start);
  const path: SolveStep[] = [...opened.steps];
  const visited = new Set<string>();
  let current = opened.state;
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
      const extra = autoplay(applied);
      const nextKey = stateKey(extra.state);
      if (nextKey !== key && !visited.has(nextKey)) {
        step = candidate;
        next = extra.state;
        path.push(candidate, ...extra.steps);
        break;
      }
    }
    if (!step || !next) {
      return null;
    }

    idleDraws = step.type === 'draw' ? idleDraws + 1 : 0;
    if (idleDraws > current.stock.length + current.waste.length + 1) {
      return null;
    }
    current = next;
  }

  return path;
}

type SearchNode = {
  state: GameState;
  stepsFromParent: SolveStep[];
  parent: SearchNode | null;
  depth: number;
  priority: number;
};

function searchBestFirst(start: GameState): SolveStep[] | null {
  const opened = autoplay(start);
  if (opened.state.won) {
    return opened.steps;
  }

  const visited = new Set<string>([stateKey(opened.state)]);
  const heap = new MaxHeap<SearchNode>();
  let seq = 0;

  heap.push({
    state: opened.state,
    stepsFromParent: opened.steps,
    parent: null,
    depth: opened.steps.length,
    priority: heuristic(opened.state) * 1_000_000 - seq++,
  });

  while (heap.size > 0 && visited.size < SEARCH_LIMIT) {
    const node = heap.pop();
    if (!node) {
      break;
    }
    if (node.state.won) {
      return reconstruct(node);
    }
    if (node.depth >= MAX_PATH) {
      continue;
    }

    for (const step of orderedMoves(node.state)) {
      const applied = applySolveStep(node.state, step);
      if (stateKey(applied) === stateKey(node.state)) {
        continue;
      }
      const extra = autoplay(applied);
      const key = stateKey(extra.state);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      const next: SearchNode = {
        state: extra.state,
        stepsFromParent: [step, ...extra.steps],
        parent: node,
        depth: node.depth + 1 + extra.steps.length,
        priority: heuristic(extra.state) * 1_000_000 - seq++,
      };
      if (extra.state.won) {
        return reconstruct(next);
      }
      heap.push(next);
    }

    if (heap.size > MAX_FRONTIER) {
      heap.trim(Math.floor(MAX_FRONTIER / 2));
    }
  }

  return null;
}

function autoplay(state: GameState): { state: GameState; steps: SolveStep[] } {
  const steps: SolveStep[] = [];
  let current = state;
  while (!current.won) {
    const move = nextSafeFoundationMove(current);
    if (!move) {
      break;
    }
    const next = applySolveStep(current, move);
    if (stateKey(next) === stateKey(current)) {
      break;
    }
    steps.push(move);
    current = next;
  }
  return { state: current, steps };
}

function nextSafeFoundationMove(state: GameState): SolveStep | null {
  for (const step of generateMoves(state)) {
    if (step.type !== 'move' || step.to.zone !== 'foundation') {
      continue;
    }
    const card = cardAt(state, step.from);
    if (card && card.rank <= 2) {
      return step;
    }
  }
  return null;
}

function cardAt(state: GameState, from: ClickTarget): Card | undefined {
  if (from.zone === 'waste') {
    return state.waste[state.waste.length - 1];
  }
  if (from.zone === 'foundation') {
    const pile = state.foundations[from.pile];
    return pile[pile.length - 1];
  }
  if (from.zone === 'tableau' && from.index != null) {
    return state.tableau[from.pile][from.index];
  }
  return undefined;
}

function heuristic(state: GameState): number {
  let foundations = 0;
  let faceDown = 0;
  for (const pile of state.foundations) {
    foundations += pile.length;
  }
  for (const pile of state.tableau) {
    for (const card of pile) {
      if (!card.faceUp) {
        faceDown += 1;
      }
    }
  }
  return foundations * 100 - faceDown;
}

function reconstruct(node: SearchNode): SolveStep[] {
  const chunks: SolveStep[][] = [];
  let current: SearchNode | null = node;
  while (current) {
    chunks.push(current.stepsFromParent);
    current = current.parent;
  }
  return chunks.reverse().flat();
}

class MaxHeap<T extends { priority: number }> {
  private readonly items: T[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: T) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): T | undefined {
    if (this.items.length === 0) {
      return undefined;
    }
    const top = this.items[0];
    const last = this.items.pop();
    if (last && this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  trim(keep: number) {
    if (this.items.length <= keep) {
      return;
    }
    this.items.sort((a, b) => b.priority - a.priority);
    this.items.length = keep;
    for (let i = Math.floor(this.items.length / 2) - 1; i >= 0; i--) {
      this.bubbleDown(i);
    }
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].priority >= this.items[index].priority) {
        return;
      }
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      index = parent;
    }
  }

  private bubbleDown(index: number) {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let best = index;
      if (left < this.items.length && this.items[left].priority > this.items[best].priority) {
        best = left;
      }
      if (right < this.items.length && this.items[right].priority > this.items[best].priority) {
        best = right;
      }
      if (best === index) {
        return;
      }
      [this.items[best], this.items[index]] = [this.items[index], this.items[best]];
      index = best;
    }
  }
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
    return 2;
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
