export type UserStats = {
  gamesWon: number;
  gamesNotCompleted: number;
  totalWonMs: number;
  fastestWonMs: number | null;
  lastWinDealId: string | null;
};

export const EMPTY_USER_STATS: UserStats = {
  gamesWon: 0,
  gamesNotCompleted: 0,
  totalWonMs: 0,
  fastestWonMs: null,
  lastWinDealId: null,
};

/** Incomplete games shorter than this are omitted from the not-completed count and total tally. */
export const MIN_STATS_GAME_MS = 15_000;

export function applyWin(stats: UserStats, elapsedMs: number, dealId: string): UserStats {
  if (dealId.length > 0 && stats.lastWinDealId === dealId) {
    return stats;
  }

  const time = Math.max(0, Math.floor(elapsedMs));
  return {
    gamesWon: stats.gamesWon + 1,
    gamesNotCompleted: stats.gamesNotCompleted,
    totalWonMs: stats.totalWonMs + time,
    fastestWonMs: stats.fastestWonMs == null ? time : Math.min(stats.fastestWonMs, time),
    lastWinDealId: dealId.length > 0 ? dealId : stats.lastWinDealId,
  };
}

export function applyIncomplete(stats: UserStats, elapsedMs: number): UserStats {
  const time = Math.max(0, Math.floor(elapsedMs));
  if (time < MIN_STATS_GAME_MS) {
    return stats;
  }

  return {
    ...stats,
    gamesNotCompleted: stats.gamesNotCompleted + 1,
  };
}

export function winRatePercent(stats: UserStats): number | null {
  const decided = stats.gamesWon + stats.gamesNotCompleted;
  if (decided === 0) {
    return null;
  }
  return (stats.gamesWon / decided) * 100;
}

export function averageWonMs(stats: UserStats): number | null {
  if (stats.gamesWon === 0) {
    return null;
  }
  return Math.round(stats.totalWonMs / stats.gamesWon);
}

export function parseUserStats(data: unknown): UserStats {
  if (!isRecord(data)) {
    return { ...EMPTY_USER_STATS };
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
    return { ...EMPTY_USER_STATS };
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
