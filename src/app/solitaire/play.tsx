import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BASE_CARD_WIDTH,
  CARD_ASPECT,
  FACE_DOWN_PEEK_RATIO,
  FACE_UP_PEEK_RATIO,
  SolitaireCard,
} from '@/components/playing-card';
import {
  SOLVER_ACTION_AT_MS,
  SOLVER_RING_MS,
  SlotAnchor,
  SlotBoard,
  solverSlotId,
} from '@/components/solver-click-ring';
import { SettingsHeaderRight } from '@/components/settings-button';
import { StackBackButton } from '@/components/stack-back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { CountAutoSolveCheckbox } from '@/debug/count-auto-solve-checkbox';
import { getCountAutoSolveWins, setCountAutoSolveWins, shouldRecordAutoSolveWin } from '@/debug/flags';
import { formatElapsed } from '@/game/format-time';
import {
  TABLEAU_COUNT,
  formatCard,
  handleClick,
  isCardSelected,
  newGame,
  type Card,
  type ClickTarget,
  type DrawCount,
  type GameState,
} from '@/game/solitaire';
import {
  clearSolitaireInProgress,
  loadSolitaireInProgress,
  saveSolitaireInProgress,
} from '@/game/solitaire-progress';
import { createDealId } from '@/game/solitaire-save';
import { applySolveStep, findSolution } from '@/game/solitaire-solver';
import { recordIncompleteGame, recordSolitaireWin } from '@/game/user-stats-store';
import { useTheme } from '@/hooks/use-theme';
import { useUserSettings } from '@/hooks/use-user-settings';

const ROW_GAP = Spacing.four;
const MIN_CARD_WIDTH = 40;
const MIN_COLUMN_GAP = 6;
const SOLVE_MOVE_DELAY_MS = 1000;

type LeaveConfirm = 'back' | 'newGame';

function firstParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type CardLayout = {
  cardWidth: number;
  cardHeight: number;
  columnGap: number;
  tableauGap: number;
  faceUpPeek: number;
  faceDownPeek: number;
};

function layoutCards(width: number, height: number): CardLayout {
  if (width <= 0) {
    const cardWidth = BASE_CARD_WIDTH;
    const cardHeight = cardWidth * CARD_ASPECT;
    return {
      cardWidth,
      cardHeight,
      columnGap: Spacing.one,
      tableauGap: Spacing.one,
      faceUpPeek: cardHeight * FACE_UP_PEEK_RATIO,
      faceDownPeek: cardHeight * FACE_DOWN_PEEK_RATIO,
    };
  }

  let cardWidth = (width - MIN_COLUMN_GAP * (TABLEAU_COUNT - 1)) / TABLEAU_COUNT;
  if (height > 0) {
    const maxCardHeight = (height - ROW_GAP) / 2;
    cardWidth = Math.min(cardWidth, maxCardHeight / CARD_ASPECT);
  }

  cardWidth = Math.max(MIN_CARD_WIDTH, Math.floor(cardWidth));
  const leftover = Math.max(0, width - cardWidth * TABLEAU_COUNT);
  const tableauGap = leftover / (TABLEAU_COUNT - 1);
  const cardHeight = cardWidth * CARD_ASPECT;

  return {
    cardWidth,
    cardHeight,
    columnGap: Math.min(MIN_COLUMN_GAP, tableauGap),
    tableauGap,
    faceUpPeek: cardHeight * FACE_UP_PEEK_RATIO,
    faceDownPeek: cardHeight * FACE_DOWN_PEEK_RATIO,
  };
}

function useGameTimer(paused: boolean, epoch: number, initialMs: number): number {
  const [elapsedMs, setElapsedMs] = useState(initialMs);
  const frozenMs = useRef(initialMs);
  const runningSince = useRef<number | null>(null);
  const seed = useRef({ epoch, initialMs });

  if (seed.current.epoch !== epoch || seed.current.initialMs !== initialMs) {
    seed.current = { epoch, initialMs };
    frozenMs.current = initialMs;
    runningSince.current = null;
    setElapsedMs(initialMs);
  }

  useEffect(() => {
    if (paused) {
      if (runningSince.current !== null) {
        frozenMs.current += Date.now() - runningSince.current;
        runningSince.current = null;
        setElapsedMs(frozenMs.current);
      }
      return;
    }

    runningSince.current = Date.now();
    const id = setInterval(() => {
      const started = runningSince.current;
      if (started === null) {
        return;
      }
      setElapsedMs(frozenMs.current + Date.now() - started);
    }, 250);

    return () => {
      clearInterval(id);
    };
  }, [epoch, initialMs, paused]);

  return elapsedMs;
}

export default function SolitaireScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { settings } = useUserSettings();
  const hideTimer = settings.solitaire.hideTimer;
  const { mode, draw } = useLocalSearchParams<{
    mode?: string | string[];
    draw?: string | string[];
  }>();
  const resume = firstParam(mode) === 'continue';
  const requestedDraw: DrawCount = firstParam(draw) === '3' ? 3 : 1;
  const leavingRef = useRef(false);
  const pendingLeaveActionRef = useRef<Parameters<(typeof navigation)['dispatch']>[0] | null>(null);
  const abortSolveRef = useRef(false);
  const pulseTokenRef = useRef(0);
  const [solverPulse, setSolverPulse] = useState<{
    token: number;
    ids: ReadonlySet<string>;
  } | null>(null);
  const [paused, setPaused] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState<LeaveConfirm | null>(null);
  const [confirmSolve, setConfirmSolve] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [solving, setSolving] = useState(false);
  const [unsolvable, setUnsolvable] = useState(false);
  const [autoSolved, setAutoSolved] = useState(false);
  const [countAutoSolveWins, setCountAutoSolveWinsState] = useState(getCountAutoSolveWins);
  const [timerEpoch, setTimerEpoch] = useState(0);
  const [timerStartMs, setTimerStartMs] = useState(0);
  const [dealId, setDealId] = useState('');
  const [game, setGame] = useState<GameState | null>(null);
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const [headerHeight, setHeaderHeight] = useState(44);
  const [helpOpen, setHelpOpen] = useState(false);
  const overlayOpen = confirmLeave != null || confirmSolve || unsolvable || thinking;
  const busy = overlayOpen || solving;
  const timerPaused = game == null || paused || game.won || overlayOpen;
  const elapsedMs = useGameTimer(timerPaused, timerEpoch, timerStartMs);
  const layout = useMemo(
    () => layoutCards(boardSize.width, Math.max(0, boardSize.height - headerHeight)),
    [boardSize.height, boardSize.width, headerHeight],
  );
  const timeLabel = formatElapsed(elapsedMs);
  const screenTitle = game
    ? game.drawCount === 3
      ? '3-card Solitaire'
      : '1-card Solitaire'
    : resume
      ? 'Solitaire'
      : requestedDraw === 3
        ? '3-card Solitaire'
        : '1-card Solitaire';
  const backLabel = navigation.canGoBack() ? 'Back' : 'Home';

  useEffect(() => {
    if (overlayOpen || paused || game?.won) {
      setHelpOpen(false);
    }
  }, [game?.won, overlayOpen, paused]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (resume) {
        const saved = await loadSolitaireInProgress();
        if (cancelled) {
          return;
        }
        if (saved) {
          setDealId(saved.dealId || createDealId());
          setGame(saved.game);
          setTimerStartMs(saved.elapsedMs);
          return;
        }
        router.replace('/solitaire');
        return;
      }
      setDealId(createDealId());
      setGame(newGame(Math.random, requestedDraw));
      setTimerStartMs(0);
    })();
    return () => {
      cancelled = true;
    };
  }, [requestedDraw, resume]);

  useEffect(() => {
    return () => {
      abortSolveRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (game == null || !game.won || !dealId) {
      return;
    }
    if (autoSolved && !shouldRecordAutoSolveWin(countAutoSolveWins)) {
      void clearSolitaireInProgress();
      return;
    }
    void recordSolitaireWin(dealId, elapsedMs, game.drawCount).then(() => clearSolitaireInProgress());
  }, [autoSolved, countAutoSolveWins, dealId, elapsedMs, game]);

  useEffect(() => {
    if (game == null || game.won) {
      return;
    }

    return navigation.addListener('beforeRemove', (event) => {
      if (leavingRef.current) {
        return;
      }
      event.preventDefault();
      pendingLeaveActionRef.current = event.data.action;
      setConfirmLeave('back');
    });
  }, [game, navigation]);

  const helpText = useMemo(() => {
    if (game == null) {
      return '';
    }
    if (game.selected) {
      return 'Tap a pile to move, or tap the card again to cancel.';
    }
    return game.drawCount === 3
      ? 'Tap a card, then tap where it should go. Tap the stock to draw three cards.'
      : 'Tap a card, then tap where it should go. Tap the stock to draw.';
  }, [game]);

  const startNewGame = () => {
    abortSolveRef.current = true;
    if (game != null && !game.won) {
      void recordIncompleteGame(elapsedMs, game.drawCount, game, unsolvable ? false : undefined);
    }
    leavingRef.current = false;
    setDealId(createDealId());
    setGame(newGame(Math.random, game?.drawCount ?? requestedDraw));
    setPaused(false);
    setConfirmLeave(null);
    setConfirmSolve(false);
    setThinking(false);
    setSolving(false);
    setUnsolvable(false);
    setAutoSolved(false);
    setSolverPulse(null);
    setTimerStartMs(0);
    setTimerEpoch((value) => value + 1);
    void clearSolitaireInProgress();
  };

  const pauseGame = () => {
    abortSolveRef.current = true;
    leavingRef.current = false;
    setConfirmSolve(false);
    setThinking(false);
    setSolving(false);
    setUnsolvable(false);
    setSolverPulse(null);
    if (game != null && !game.won) {
      setAutoSolved(false);
    }
    setPaused(true);
  };

  const cancelLeave = () => {
    pendingLeaveActionRef.current = null;
    setConfirmLeave(null);
  };

  const requestNewGame = () => {
    if (game != null && !game.won) {
      setConfirmLeave('newGame');
      return;
    }
    startNewGame();
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
      title: screenTitle,
    });
  }, [navigation, screenTitle]);

  const saveAndExit = () => {
    abortSolveRef.current = true;
    leavingRef.current = true;
    setConfirmLeave(null);
    const action = pendingLeaveActionRef.current;
    pendingLeaveActionRef.current = null;
    if (game != null && !game.won) {
      void saveSolitaireInProgress(game, elapsedMs, dealId).finally(() => {
        if (action) {
          navigation.dispatch(action);
          return;
        }
        router.replace('/');
      });
      return;
    }
    if (action) {
      navigation.dispatch(action);
      return;
    }
    router.replace('/');
  };

  const leaveToHome = () => {
    abortSolveRef.current = true;
    leavingRef.current = true;
    if (game != null && !game.won) {
      void saveSolitaireInProgress(game, elapsedMs, dealId).finally(() => {
        router.replace('/');
      });
      return;
    }
    router.replace('/');
  };

  const play = (target: ClickTarget) => {
    if (busy) {
      return;
    }
    setGame((current) => (current ? handleClick(current, target) : current));
  };

  const startSolve = (current: GameState) => {
    abortSolveRef.current = false;
    setConfirmSolve(false);
    setUnsolvable(false);
    setAutoSolved(true);
    setThinking(true);

    const runSearch = () => {
      if (abortSolveRef.current) {
        return;
      }
      const steps = findSolution(current);
      if (abortSolveRef.current) {
        return;
      }
      if (!steps) {
        setAutoSolved(false);
        setThinking(false);
        setUnsolvable(true);
        return;
      }

      setThinking(false);
      setSolving(true);
      void (async () => {
        let board = current;
        for (const step of steps) {
          await new Promise((resolve) => setTimeout(resolve, SOLVE_MOVE_DELAY_MS - SOLVER_RING_MS));
          if (abortSolveRef.current) {
            return;
          }
          const clicks = step.type === 'draw' ? [{ zone: 'stock' as const }] : [step.from, step.to];
          const ids = new Set(clicks.map((target) => solverSlotId(target, board)));
          pulseTokenRef.current += 1;
          setSolverPulse({ token: pulseTokenRef.current, ids });
          await new Promise((resolve) => setTimeout(resolve, SOLVER_ACTION_AT_MS));
          if (abortSolveRef.current) {
            setSolverPulse(null);
            return;
          }
          board = applySolveStep(board, step);
          setGame(board);
          await new Promise((resolve) => setTimeout(resolve, SOLVER_RING_MS - SOLVER_ACTION_AT_MS));
          if (abortSolveRef.current) {
            setSolverPulse(null);
            return;
          }
          setSolverPulse(null);
        }
        setSolving(false);
      })();
    };

    // Let the loading overlay paint before the blocking search.
    requestAnimationFrame(() => {
      setTimeout(runSearch, 50);
    });
  };

  const playToolbar = (
    <PlayToolbar
      title={screenTitle}
      backLabel={backLabel}
      game={game}
      helpOpen={helpOpen}
      hideTimer={hideTimer}
      timeLabel={timeLabel}
      busy={busy}
      thinking={thinking}
      solving={solving}
      onToggleHelp={() => setHelpOpen((value) => !value)}
      onPause={pauseGame}
      onSolve={() => setConfirmSolve(true)}
      onNewGame={requestNewGame}
      onLayout={(event) => {
        const height = event.nativeEvent.layout.height;
        setHeaderHeight((current) => (current === height ? current : height));
      }}
    />
  );

  if (game == null) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
          <View style={styles.board}>{playToolbar}</View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        {__DEV__ ? (
          <CountAutoSolveCheckbox
            value={countAutoSolveWins}
            onValueChange={(value) => {
              setCountAutoSolveWins(value);
              setCountAutoSolveWinsState(value);
            }}
          />
        ) : null}

        <View style={styles.board}>
          <SlotBoard
            pulse={solverPulse}
            style={styles.boardInner}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setBoardSize((current) =>
                current.width === width && current.height === height ? current : { width, height },
              );
            }}>
            <ScrollView
              style={styles.tableauArea}
              contentContainerStyle={[
                styles.tableauScrollContent,
                { paddingBottom: Spacing.three + headerHeight },
              ]}
              stickyHeaderIndices={[1]}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              removeClippedSubviews={false}
              contentInsetAdjustmentBehavior="never"
              showsVerticalScrollIndicator>
              <View collapsable={false}>{playToolbar}</View>
              <View
                collapsable={false}
                style={[styles.stickyTop, { backgroundColor: theme.background }]}
                accessibilityLabel="Solitaire board">
                <View style={styles.topRow}>
                  <View style={[styles.foundations, { gap: layout.columnGap }]}>
                    {game.foundations.map((pile, pileIndex) => {
                      const top = pile[pile.length - 1];
                      return (
                        <SlotAnchor key={`foundation-${pileIndex}`} slotId={`foundation-${pileIndex}`}>
                          <SolitaireCard
                            width={layout.cardWidth}
                            card={top}
                            emptyHint="A"
                            selected={isCardSelected(game, { zone: 'foundation', pile: pileIndex })}
                            accessibilityLabel={
                              top ? `Foundation ${formatCard(top)}` : `Empty foundation ${pileIndex + 1}`
                            }
                            onPress={() => play({ zone: 'foundation', pile: pileIndex })}
                          />
                        </SlotAnchor>
                      );
                    })}
                  </View>

                  <View style={[styles.stockWaste, { gap: layout.columnGap }]}>
                    <WastePile game={game} layout={layout} onPress={() => play({ zone: 'waste' })} />
                    <SlotAnchor slotId="stock">
                      <SolitaireCard
                        width={layout.cardWidth}
                        faceDown={game.stock.length > 0}
                        faceDownLabel={game.stock.length ? String(game.stock.length) : undefined}
                        emptyHint={game.waste.length ? '↺' : 'Stock'}
                        accessibilityLabel={
                          game.stock.length
                            ? `Stock, ${game.stock.length} cards`
                            : game.waste.length
                              ? 'Recycle waste into stock'
                              : 'Empty stock'
                        }
                        onPress={() => play({ zone: 'stock' })}
                      />
                    </SlotAnchor>
                  </View>
                </View>
              </View>
              <View style={[styles.tableau, { gap: layout.tableauGap }]}>
                {game.tableau.map((pile, pileIndex) => (
                  <View
                    key={`tableau-${pileIndex}`}
                    style={[
                      styles.pile,
                      {
                        width: layout.cardWidth,
                        height: pileHeight(pile, layout),
                      },
                    ]}
                    accessibilityLabel={`Tableau pile ${pileIndex + 1}`}>
                    {pile.length === 0 ? (
                      <SlotAnchor slotId={`tableau-${pileIndex}-empty`}>
                        <SolitaireCard
                          width={layout.cardWidth}
                          emptyHint="K"
                          accessibilityLabel={`Empty tableau pile ${pileIndex + 1}`}
                          onPress={() => play({ zone: 'tableau', pile: pileIndex })}
                        />
                      </SlotAnchor>
                    ) : (
                      pile.map((item, index) => (
                        <View
                          key={item.id}
                          style={[
                            styles.stackedCard,
                            {
                              top: cardOffset(pile, index, layout),
                              zIndex: index,
                              width: layout.cardWidth,
                              height: layout.cardHeight,
                            },
                          ]}>
                          <SlotAnchor slotId={`tableau-${pileIndex}-${index}`}>
                            <SolitaireCard
                              width={layout.cardWidth}
                              card={item.faceUp ? item : undefined}
                              faceDown={!item.faceUp}
                              selected={isCardSelected(game, { zone: 'tableau', pile: pileIndex, index })}
                              accessibilityLabel={
                                item.faceUp
                                  ? `Tableau ${formatCard(item)}`
                                  : `Face-down card in pile ${pileIndex + 1}`
                              }
                              onPress={() => play({ zone: 'tableau', pile: pileIndex, index })}
                            />
                          </SlotAnchor>
                        </View>
                      ))
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          </SlotBoard>
        </View>
      </SafeAreaView>

      {helpOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss help"
          onPress={() => setHelpOpen(false)}
          style={styles.helpDismiss}>
          <ThemedView
            type="backgroundElement"
            accessibilityRole="text"
            accessibilityLabel={helpText}
            style={styles.helpBubble}>
            <ThemedText type="small">{helpText}</ThemedText>
          </ThemedView>
        </Pressable>
      ) : null}

      {game.won ? (
        <ThemedView
          style={styles.overlay}
          accessibilityViewIsModal
          accessibilityLabel={
            hideTimer
              ? autoSolved
                ? 'Solved'
                : 'You won'
              : autoSolved
                ? `Solved in ${timeLabel}`
                : `You won in ${timeLabel}`
          }>
          <View style={styles.pauseMenu}>
            <ThemedText type="subtitle" style={styles.winTitle}>
              {autoSolved ? 'Solved' : 'You won'}
            </ThemedText>
            {hideTimer ? null : (
              <ThemedText
                type="title"
                accessibilityRole="timer"
                accessibilityLabel={`Final time ${timeLabel}`}
                style={styles.winTime}>
                {timeLabel}
              </ThemedText>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New Game"
              onPress={startNewGame}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle" style={styles.menuButtonLabel}>
                  New Game
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Menu"
              onPress={leaveToHome}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle" style={styles.menuButtonLabel}>
                  Menu
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>
        </ThemedView>
      ) : confirmLeave ? (
        <ConfirmLeaveMenu
          confirmLabel={confirmLeave === 'newGame' ? 'New Game' : 'Save and Exit'}
          onCancel={cancelLeave}
          onConfirm={confirmLeave === 'newGame' ? startNewGame : saveAndExit}
        />
      ) : unsolvable ? (
        <ThemedView
          style={styles.overlay}
          accessibilityViewIsModal
          accessibilityLabel="This game can't be solved">
          <View style={styles.pauseMenu}>
            <ThemedText type="subtitle" style={styles.winTitle}>
              This game can't be solved
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New Game"
              onPress={startNewGame}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle" style={styles.menuButtonLabel}>
                  New Game
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="We'll See About That"
              onPress={() => setUnsolvable(false)}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle" style={styles.menuButtonLabel}>
                  We'll See About That
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>
        </ThemedView>
      ) : confirmSolve ? (
        <ThemedView
          style={styles.overlay}
          accessibilityViewIsModal
          accessibilityLabel="Solve this game?">
          <View style={styles.pauseMenu}>
            <ThemedText type="subtitle" style={styles.winTitle}>
              Solve this game?
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.winTitle}>
              {shouldRecordAutoSolveWin(countAutoSolveWins)
                ? 'Moves play automatically. This win will count toward your stats.'
                : 'Moves play automatically. A solved game does not count toward your stats.'}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Solve"
              onPress={() => startSolve(game)}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle" style={styles.menuButtonLabel}>
                  Solve
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => setConfirmSolve(false)}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle" style={styles.menuButtonLabel}>
                  Cancel
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>
        </ThemedView>
      ) : thinking ? (
        <ThemedView
          style={styles.overlay}
          accessibilityViewIsModal
          accessibilityLabel="Looking for a solution">
          <View style={styles.pauseMenu}>
            <ActivityIndicator size="large" color={theme.text} />
            <ThemedText type="subtitle" style={styles.winTitle}>
              Looking for a solution…
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.winTitle}>
              This can take a little while.
            </ThemedText>
          </View>
        </ThemedView>
      ) : paused ? (
        <ThemedView
          style={styles.overlay}
          accessibilityViewIsModal
          accessibilityLabel="Game paused">
          <View style={styles.pauseMenu}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Resume"
              onPress={() => setPaused(false)}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle" style={styles.menuButtonLabel}>
                  Resume
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save and Exit"
              onPress={leaveToHome}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle" style={styles.menuButtonLabel}>
                  Save and Exit
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>
        </ThemedView>
      ) : null}
    </ThemedView>
  );
}

function PlayToolbar({
  title,
  backLabel,
  game,
  helpOpen,
  hideTimer,
  timeLabel,
  busy,
  thinking,
  solving,
  onToggleHelp,
  onPause,
  onSolve,
  onNewGame,
  onLayout,
}: {
  title: string;
  backLabel: string;
  game: GameState | null;
  helpOpen: boolean;
  hideTimer: boolean;
  timeLabel: string;
  busy: boolean;
  thinking: boolean;
  solving: boolean;
  onToggleHelp: () => void;
  onPause: () => void;
  onSolve: () => void;
  onNewGame: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  return (
    <ThemedView style={styles.playHeader} onLayout={onLayout}>
      <StackBackButton label={backLabel} inNativeHeader={false} />
      <ThemedText type="smallBold" numberOfLines={1} style={styles.playHeaderTitle}>
        {title}
      </ThemedText>
      <SettingsHeaderRight>
        {game == null ? null : (
          <>
            <InfoButton open={helpOpen} onPress={onToggleHelp} />
            {hideTimer ? null : (
              <ThemedText
                type="smallBold"
                accessibilityRole="timer"
                accessibilityLabel={`Elapsed time ${timeLabel}`}
                style={styles.timer}>
                {timeLabel}
              </ThemedText>
            )}
            <HeaderAction label="Pause" disabled={game.won} onPress={onPause} />
            <HeaderAction label="Solve" disabled={busy || game.won} onPress={onSolve} />
            <HeaderAction label="New Game" disabled={thinking || solving} onPress={onNewGame} />
          </>
        )}
      </SettingsHeaderRight>
    </ThemedView>
  );
}

function HeaderAction({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerAction,
        { backgroundColor: theme.backgroundSelected },
        pressed && !disabled && styles.pressed,
        disabled && styles.headerActionDisabled,
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

function InfoButton({ open, onPress }: { open: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="How to play"
      accessibilityState={{ expanded: open }}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}>
      <SymbolView
        name={{ ios: 'info.circle', android: 'info', web: 'info' }}
        size={18}
        tintColor={theme.text}
        fallback={<ThemedText type="smallBold">i</ThemedText>}
      />
    </Pressable>
  );
}

function ConfirmLeaveMenu({
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ThemedView
      style={styles.overlay}
      accessibilityViewIsModal
      accessibilityLabel="Leave game?">
      <View style={styles.pauseMenu}>
        <ThemedText type="subtitle" style={styles.winTitle}>
          Leave game?
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onCancel}
          style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
          <ThemedView type="backgroundElement" style={styles.pauseButton}>
            <ThemedText type="subtitle" style={styles.menuButtonLabel}>
              Cancel
            </ThemedText>
          </ThemedView>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          onPress={onConfirm}
          style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
          <ThemedView type="backgroundElement" style={styles.pauseButton}>
            <ThemedText type="subtitle" style={styles.menuButtonLabel}>
              {confirmLabel}
            </ThemedText>
          </ThemedView>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function cardOffset(pile: Card[], index: number, layout: CardLayout): number {
  let offset = 0;
  for (let i = 0; i < index; i++) {
    offset += pile[i].faceUp ? layout.faceUpPeek : layout.faceDownPeek;
  }
  return offset;
}

function pileHeight(pile: Card[], layout: CardLayout): number {
  if (pile.length === 0) {
    return layout.cardHeight;
  }
  return cardOffset(pile, pile.length - 1, layout) + layout.cardHeight;
}

function wasteFanPeek(cardWidth: number): number {
  return Math.max(16, Math.round(cardWidth * 0.34));
}

function visibleWaste(game: GameState): Card[] {
  if (game.waste.length === 0) {
    return [];
  }
  return game.drawCount === 3 ? game.waste.slice(-3) : game.waste.slice(-1);
}

function WastePile({
  game,
  layout,
  onPress,
}: {
  game: GameState;
  layout: CardLayout;
  onPress: () => void;
}) {
  const visible = visibleWaste(game);
  const selected = isCardSelected(game, { zone: 'waste' });
  const peek = wasteFanPeek(layout.cardWidth);
  const fanSlots = game.drawCount === 3 ? 3 : 1;
  const width = layout.cardWidth + peek * (fanSlots - 1);

  if (visible.length === 0) {
    return (
      <View style={{ width, height: layout.cardHeight }}>
        <SlotAnchor slotId="waste">
          <SolitaireCard
            width={layout.cardWidth}
            emptyHint="W"
            selected={false}
            accessibilityLabel="Empty waste"
            onPress={onPress}
          />
        </SlotAnchor>
      </View>
    );
  }

  return (
    <View style={{ width, height: layout.cardHeight }}>
      {visible.map((card, index) => {
        const top = index === visible.length - 1;
        const face = (
          <SolitaireCard
            width={layout.cardWidth}
            card={card}
            selected={top && selected}
            accessibilityLabel={top ? `Waste ${formatCard(card)}` : `Covered waste ${formatCard(card)}`}
            onPress={onPress}
          />
        );
        return (
          <View
            key={card.id}
            style={[
              styles.stackedCard,
              {
                left: index * peek,
                zIndex: index,
                width: layout.cardWidth,
                height: layout.cardHeight,
              },
            ]}>
            {top ? <SlotAnchor slotId="waste">{face}</SlotAnchor> : face}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerAction: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  headerActionDisabled: {
    opacity: 0.45,
  },
  infoButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    minWidth: 52,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.75,
  },
  playHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingBottom: Spacing.two,
  },
  playHeaderTitle: {
    flex: 1,
    minWidth: 0,
  },
  stickyTop: {
    paddingBottom: ROW_GAP,
    zIndex: 2,
    overflow: 'visible',
  },
  helpDismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    alignItems: 'flex-end',
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.three,
  },
  helpBubble: {
    maxWidth: 320,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    zIndex: 20,
  },
  pauseMenu: {
    width: '100%',
    maxWidth: 420,
    gap: Spacing.three,
    alignItems: 'center',
  },
  winTitle: {
    textAlign: 'center',
  },
  winTime: {
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  pauseAction: {
    alignSelf: 'stretch',
    width: '100%',
  },
  pauseButton: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  menuButtonLabel: {
    textAlign: 'center',
  },
  board: {
    flex: 1,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.three,
  },
  boardInner: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  foundations: {
    flexDirection: 'row',
  },
  stockWaste: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    overflow: 'visible',
    flexShrink: 0,
  },
  tableauArea: {
    flex: 1,
  },
  tableauScrollContent: {
    flexGrow: 1,
  },
  tableau: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    overflow: 'visible',
  },
  pile: {
    position: 'relative',
    overflow: 'visible',
  },
  stackedCard: {
    position: 'absolute',
    left: 0,
  },
});
