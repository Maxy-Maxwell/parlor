/** True while Metro serves a development bundle. False in release builds. */
export const isDebugBuild = typeof __DEV__ !== 'undefined' && __DEV__;

let countAutoSolveWins = false;

export function getCountAutoSolveWins(): boolean {
  return countAutoSolveWins;
}

export function setCountAutoSolveWins(value: boolean): void {
  countAutoSolveWins = value;
}

/** Auto-solve wins update stats only when this debug flag is on. */
export function shouldRecordAutoSolveWin(
  flag = countAutoSolveWins,
  debug = isDebugBuild,
): boolean {
  return debug && flag;
}
