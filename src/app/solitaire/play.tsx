import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
  solverSlotId,
} from '@/components/solver-click-ring';
import { SettingsHeaderRight } from '@/components/settings-button';
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
const SOLVE_MOVE_DELAY_MS = 1000;

function firstParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type CardLayout = {
  cardWidth: number;
  cardHeight: number;
  columnGap: number;
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
      faceUpPeek: cardHeight * FACE_UP_PEEK_RATIO,
      faceDownPeek: cardHeight * FACE_DOWN_PEEK_RATIO,
    };
  }

  const columnGap = Math.max(6, Math.min(14, width * 0.012));
  let cardWidth = (width - columnGap * (TABLEAU_COUNT - 1)) / TABLEAU_COUNT;

  if (height > 0) {
    const maxCardHeight = (height - ROW_GAP) / 2.7;
    cardWidth = Math.min(cardWidth, maxCardHeight / CARD_ASPECT);
  }

  cardWidth = Math.max(MIN_CARD_WIDTH, Math.floor(cardWidth));
  const cardHeight = cardWidth * CARD_ASPECT;

  return {
    cardWidth,
    cardHeight,
    columnGap,
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
  const abortSolveRef = useRef(false);
  const pulseTokenRef = useRef(0);
  const [solverPulse, setSolverPulse] = useState<{
    token: number;
    ids: ReadonlySet<string>;
  } | null>(null);
  const [paused, setPaused] = useState(false);
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
  const busy = confirmSolve || thinking || solving || unsolvable;
  const timerPaused = game == null || paused || game.won || confirmSolve || unsolvable;
  const elapsedMs = useGameTimer(timerPaused, timerEpoch, timerStartMs);
  const layout = useMemo(
    () => layoutCards(boardSize.width, boardSize.height),
    [boardSize.height, boardSize.width],
  );
  const timeLabel = formatElapsed(elapsedMs);

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
      leavingRef.current = true;
      abortSolveRef.current = true;
      void saveSolitaireInProgress(game, elapsedMs, dealId).finally(() => {
        navigation.dispatch(event.data.action);
      });
    });
  }, [dealId, elapsedMs, game, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: game
        ? game.drawCount === 3
          ? '3-card Solitaire'
          : '1-card Solitaire'
        : resume
          ? 'Solitaire'
          : requestedDraw === 3
            ? '3-card Solitaire'
            : '1-card Solitaire',
      headerRight: () => (
        <SettingsHeaderRight>
          {game == null || hideTimer ? null : (
            <ThemedText
              type="smallBold"
              accessibilityRole="timer"
              accessibilityLabel={`Elapsed time ${timeLabel}`}
              style={styles.timer}>
              {timeLabel}
            </ThemedText>
          )}
        </SettingsHeaderRight>
      ),
    });
  }, [game, hideTimer, navigation, requestedDraw, resume, timeLabel]);

  const status = useMemo(() => {
    if (game == null) {
      return '';
    }
    if (thinking) {
      return 'Looking for a solution…';
    }
    if (solving) {
      return 'Solving…';
    }
    if (game.won) {
      return autoSolved ? 'Solved.' : 'You won.';
    }
    if (game.selected) {
      return 'Tap a pile to move, or tap the card again to cancel.';
    }
    return game.drawCount === 3
      ? 'Tap a card, then tap where it should go. Tap the stock to draw three cards.'
      : 'Tap a card, then tap where it should go. Tap the stock to draw.';
  }, [autoSolved, game, solving, thinking]);

  const startNewGame = () => {
    abortSolveRef.current = true;
    if (game != null && !game.won) {
      void recordIncompleteGame(elapsedMs, game.drawCount);
    }
    leavingRef.current = false;
    setDealId(createDealId());
    setGame(newGame(Math.random, game?.drawCount ?? requestedDraw));
    setPaused(false);
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

    setTimeout(() => {
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
    }, 50);
  };

  if (game == null) {
    return <ThemedView style={styles.screen} />;
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.toolbar}>
        <ThemedText type="small" style={styles.status}>
          {status}
        </ThemedText>
        <View style={styles.toolbarActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause"
            disabled={game.won}
            onPress={pauseGame}
            style={({ pressed }) => [
              styles.toolbarButton,
              { backgroundColor: theme.backgroundSelected },
              pressed && !game.won && styles.pressed,
            ]}>
            <ThemedText type="smallBold">Pause</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Solve"
            disabled={busy || game.won}
            onPress={() => setConfirmSolve(true)}
            style={({ pressed }) => [
              styles.toolbarButton,
              { backgroundColor: theme.backgroundSelected },
              pressed && !busy && styles.pressed,
            ]}>
            <ThemedText type="smallBold">Solve</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New game"
            disabled={thinking || solving}
            onPress={startNewGame}
            style={({ pressed }) => [
              styles.toolbarButton,
              { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">New game</ThemedText>
          </Pressable>
        </View>
      </View>

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
        <View
          style={styles.boardInner}
          accessibilityLabel="Solitaire board"
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setBoardSize((current) =>
              current.width === width && current.height === height ? current : { width, height },
            );
          }}>
          <View style={styles.topRow}>
            <View style={[styles.foundations, { gap: layout.columnGap }]}>
            {game.foundations.map((pile, pileIndex) => {
              const top = pile[pile.length - 1];
              return (
                <SlotAnchor
                  key={`foundation-${pileIndex}`}
                  slotId={`foundation-${pileIndex}`}
                  pulse={solverPulse}>
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
            <WastePile
              game={game}
              layout={layout}
              pulse={solverPulse}
              onPress={() => play({ zone: 'waste' })}
            />
            <SlotAnchor slotId="stock" pulse={solverPulse}>
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

          <ScrollView style={styles.tableauScroll} contentContainerStyle={styles.tableauContent}>
            <View style={[styles.tableau, { gap: layout.columnGap }]}>
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
                    <SlotAnchor slotId={`tableau-${pileIndex}-empty`} pulse={solverPulse}>
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
                          { top: cardOffset(pile, index, layout), zIndex: index },
                        ]}>
                        <SlotAnchor slotId={`tableau-${pileIndex}-${index}`} pulse={solverPulse}>
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
        </View>
      </View>

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
              accessibilityLabel="New game"
              onPress={startNewGame}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle" style={styles.menuButtonLabel}>
                  New game
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
              accessibilityLabel="New game"
              onPress={startNewGame}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle" style={styles.menuButtonLabel}>
                  New game
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="OK"
              onPress={() => setUnsolvable(false)}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle" style={styles.menuButtonLabel}>
                  OK
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
      ) : null}
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
  pulse,
  onPress,
}: {
  game: GameState;
  layout: CardLayout;
  pulse: { token: number; ids: ReadonlySet<string> } | null;
  onPress: () => void;
}) {
  const visible = visibleWaste(game);
  const selected = isCardSelected(game, { zone: 'waste' });
  const peek = wasteFanPeek(layout.cardWidth);
  const width = layout.cardWidth + peek * Math.max(0, visible.length - 1);

  if (visible.length === 0) {
    return (
      <SlotAnchor slotId="waste" pulse={pulse}>
        <SolitaireCard
          width={layout.cardWidth}
          emptyHint="W"
          selected={false}
          accessibilityLabel="Empty waste"
          onPress={onPress}
        />
      </SlotAnchor>
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
          <View key={card.id} style={[styles.stackedCard, { left: index * peek, zIndex: index }]}>
            {top ? (
              <SlotAnchor slotId="waste" pulse={pulse}>
                {face}
              </SlotAnchor>
            ) : (
              face
            )}
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
  toolbar: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    flex: 1,
    paddingRight: Spacing.two,
  },
  toolbarActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  toolbarButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  timer: {
    minWidth: 52,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.75,
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
    gap: ROW_GAP,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  foundations: {
    flexDirection: 'row',
  },
  stockWaste: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    overflow: 'visible',
  },
  tableauScroll: {
    flex: 1,
  },
  tableauContent: {
    flexGrow: 1,
  },
  tableau: {
    flexDirection: 'row',
    justifyContent: 'center',
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
