import type { DrawCount } from './solitaire.ts';

export type VariantStats = {
  gamesWon: number;
  gamesNotCompleted: number;
  totalWonMs: number;
  fastestWonMs: number | null;
  lastWinDealId: string | null;
};

export type UserStats = {
  byDraw: {
    1: VariantStats;
    3: VariantStats;
  };
};

export const EMPTY_VARIANT_STATS: VariantStats = {
  gamesWon: 0,
  gamesNotCompleted: 0,
  totalWonMs: 0,
  fastestWonMs: null,
  lastWinDealId: null,
};

export const EMPTY_USER_STATS: UserStats = emptyUserStats();

/** Incomplete games shorter than this are omitted from the not-completed count and total tally. */
export const MIN_STATS_GAME_MS = 15_000;

export function emptyVariantStats(): VariantStats {
  return { ...EMPTY_VARIANT_STATS };
}

export function emptyUserStats(): UserStats {
  return {
    byDraw: {
      1: emptyVariantStats(),
      3: emptyVariantStats(),
    },
  };
}

export function applyWin(
  stats: UserStats,
  elapsedMs: number,
  dealId: string,
  drawCount: DrawCount = 1,
): UserStats {
  const current = stats.byDraw[drawCount];
  if (dealId.length > 0 && current.lastWinDealId === dealId) {
    return stats;
  }

  const time = Math.max(0, Math.floor(elapsedMs));
  return replaceVariant(stats, drawCount, {
    gamesWon: current.gamesWon + 1,
    gamesNotCompleted: current.gamesNotCompleted,
    totalWonMs: current.totalWonMs + time,
    fastestWonMs: current.fastestWonMs == null ? time : Math.min(current.fastestWonMs, time),
    lastWinDealId: dealId.length > 0 ? dealId : current.lastWinDealId,
  });
}

export function applyIncomplete(
  stats: UserStats,
  elapsedMs: number,
  drawCount: DrawCount = 1,
): UserStats {
  const time = Math.max(0, Math.floor(elapsedMs));
  if (time < MIN_STATS_GAME_MS) {
    return stats;
  }

  const current = stats.byDraw[drawCount];
  return replaceVariant(stats, drawCount, {
    ...current,
    gamesNotCompleted: current.gamesNotCompleted + 1,
  });
}

export function statsForDraws(stats: UserStats, draws: readonly DrawCount[]): VariantStats {
  const selected = draws.filter((draw): draw is DrawCount => draw === 1 || draw === 3);
  if (selected.length === 0) {
    return emptyVariantStats();
  }

  return selected.slice(1).reduce(
    (combined, draw) => combineVariantStats(combined, stats.byDraw[draw]),
    { ...stats.byDraw[selected[0]] },
  );
}

export function winRatePercent(stats: VariantStats): number | null {
  const decided = stats.gamesWon + stats.gamesNotCompleted;
  if (decided === 0) {
    return null;
  }
  return (stats.gamesWon / decided) * 100;
}

export function averageWonMs(stats: VariantStats): number | null {
  if (stats.gamesWon === 0) {
    return null;
  }
  return Math.round(stats.totalWonMs / stats.gamesWon);
}

export function parseUserStats(data: unknown): UserStats {
  if (!isRecord(data)) {
    return emptyUserStats();
  }

  if (isRecord(data.byDraw)) {
    return {
      byDraw: {
        1: parseVariantStats(data.byDraw[1]) ?? emptyVariantStats(),
        3: parseVariantStats(data.byDraw[3]) ?? emptyVariantStats(),
      },
    };
  }

  const legacy = parseVariantStats(data);
  if (!legacy) {
    return emptyUserStats();
  }

  return {
    byDraw: {
      1: legacy,
      3: emptyVariantStats(),
    },
  };
}

function replaceVariant(stats: UserStats, drawCount: DrawCount, next: VariantStats): UserStats {
  return {
    byDraw: {
      ...stats.byDraw,
      [drawCount]: next,
    },
  };
}

function combineVariantStats(left: VariantStats, right: VariantStats): VariantStats {
  return {
    gamesWon: left.gamesWon + right.gamesWon,
    gamesNotCompleted: left.gamesNotCompleted + right.gamesNotCompleted,
    totalWonMs: left.totalWonMs + right.totalWonMs,
    fastestWonMs: minTime(left.fastestWonMs, right.fastestWonMs),
    lastWinDealId: right.lastWinDealId ?? left.lastWinDealId,
  };
}

function minTime(left: number | null, right: number | null): number | null {
  if (left == null) {
    return right;
  }
  if (right == null) {
    return left;
  }
  return Math.min(left, right);
}

function parseVariantStats(data: unknown): VariantStats | null {
  if (!isRecord(data)) {
    return null;
  }

  const gamesWon = asNonNegativeInt(data.gamesWon);
  const gamesNotCompleted = asNonNegativeInt(data.gamesNotCompleted);
  const totalWonMs = asNonNegativeInt(data.totalWonMs);
  const fastestWonMs =
    data.fastestWonMs === null ? null : asNonNegativeInt(data.fastestWonMs);
  const lastWinDealId = typeof data.lastWinDealId === 'string' ? data.lastWinDealId : null;

  if (
    gamesWon == null ||
    gamesNotCompleted == null ||
    totalWonMs == null ||
    fastestWonMs === undefined
  ) {
    return null;
  }

  return {
    gamesWon,
    gamesNotCompleted,
    totalWonMs,
    fastestWonMs,
    lastWinDealId,
  };
}

function asNonNegativeInt(value: unknown): number | null {
  if (!Number.isInteger(value) || Number(value) < 0) {
    return null;
  }
  return Number(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
