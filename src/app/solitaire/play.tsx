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
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatElapsed } from '@/game/format-time';
import {
  TABLEAU_COUNT,
  formatCard,
  handleClick,
  isCardSelected,
  newGame,
  type Card,
  type ClickTarget,
  type GameState,
} from '@/game/solitaire';
import {
  clearSolitaireInProgress,
  loadSolitaireInProgress,
  saveSolitaireInProgress,
} from '@/game/solitaire-progress';
import { createDealId } from '@/game/solitaire-save';
import { recordIncompleteGame, recordSolitaireWin } from '@/game/user-stats-store';

const ROW_GAP = Spacing.four;
const MIN_CARD_WIDTH = 40;

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
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const resume = (Array.isArray(mode) ? mode[0] : mode) === 'continue';
  const leavingRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [timerEpoch, setTimerEpoch] = useState(0);
  const [timerStartMs, setTimerStartMs] = useState(0);
  const [dealId, setDealId] = useState('');
  const [game, setGame] = useState<GameState | null>(null);
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const timerPaused = game == null || paused || game.won;
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
      setGame(newGame());
      setTimerStartMs(0);
    })();
    return () => {
      cancelled = true;
    };
  }, [resume]);

  useEffect(() => {
    if (!game?.won || !dealId) {
      return;
    }
    void recordSolitaireWin(dealId, elapsedMs).then(() => clearSolitaireInProgress());
  }, [dealId, elapsedMs, game?.won]);

  useEffect(() => {
    if (!paused || game == null || game.won) {
      return;
    }

    return navigation.addListener('beforeRemove', (event) => {
      if (leavingRef.current) {
        return;
      }
      event.preventDefault();
      leavingRef.current = true;
      void saveSolitaireInProgress(game, elapsedMs, dealId).finally(() => {
        navigation.dispatch(event.data.action);
      });
    });
  }, [dealId, elapsedMs, game, navigation, paused]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight:
        game == null
          ? undefined
          : () => (
              <ThemedText
                type="smallBold"
                accessibilityRole="timer"
                accessibilityLabel={`Elapsed time ${timeLabel}`}
                style={styles.timer}>
                {timeLabel}
              </ThemedText>
            ),
    });
  }, [game, navigation, timeLabel]);

  const status = useMemo(() => {
    if (game == null) {
      return '';
    }
    if (game.won) {
      return 'You won.';
    }
    if (game.selected) {
      return 'Tap a pile to move, or tap the card again to cancel.';
    }
    return 'Tap a card, then tap where it should go. Tap the stock to draw.';
  }, [game]);

  const startNewGame = () => {
    if (game != null && !game.won) {
      void recordIncompleteGame();
    }
    leavingRef.current = false;
    setDealId(createDealId());
    setGame(newGame());
    setPaused(false);
    setTimerStartMs(0);
    setTimerEpoch((value) => value + 1);
    void clearSolitaireInProgress();
  };

  const play = (target: ClickTarget) => {
    setGame((current) => (current ? handleClick(current, target) : current));
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
            onPress={() => setPaused(true)}
            style={({ pressed }) => [styles.toolbarButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold">Pause</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New game"
            onPress={startNewGame}
            style={({ pressed }) => [styles.toolbarButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold">New game</ThemedText>
          </Pressable>
        </View>
      </View>

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
                <SolitaireCard
                  key={`foundation-${pileIndex}`}
                  width={layout.cardWidth}
                  card={top}
                  emptyHint="A"
                  selected={isCardSelected(game, { zone: 'foundation', pile: pileIndex })}
                  accessibilityLabel={
                    top ? `Foundation ${formatCard(top)}` : `Empty foundation ${pileIndex + 1}`
                  }
                  onPress={() => play({ zone: 'foundation', pile: pileIndex })}
                />
              );
            })}
          </View>

          <View style={[styles.stockWaste, { gap: layout.columnGap }]}>
            <SolitaireCard
              width={layout.cardWidth}
              card={game.waste[game.waste.length - 1]}
              emptyHint="W"
              selected={isCardSelected(game, { zone: 'waste' })}
              accessibilityLabel={
                game.waste.length
                  ? `Waste ${formatCard(game.waste[game.waste.length - 1])}`
                  : 'Empty waste'
              }
              onPress={() => play({ zone: 'waste' })}
            />
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
                    <SolitaireCard
                      width={layout.cardWidth}
                      emptyHint="K"
                      accessibilityLabel={`Empty tableau pile ${pileIndex + 1}`}
                      onPress={() => play({ zone: 'tableau', pile: pileIndex })}
                    />
                  ) : (
                    pile.map((item, index) => (
                      <View
                        key={item.id}
                        style={[
                          styles.stackedCard,
                          { top: cardOffset(pile, index, layout), zIndex: index },
                        ]}>
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
          accessibilityLabel={`You won in ${timeLabel}`}>
          <View style={styles.pauseMenu}>
            <ThemedText type="subtitle" style={styles.winTitle}>
              You won
            </ThemedText>
            <ThemedText
              type="title"
              accessibilityRole="timer"
              accessibilityLabel={`Final time ${timeLabel}`}
              style={styles.winTime}>
              {timeLabel}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New game"
              onPress={startNewGame}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle">1. New game</ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Menu"
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle">2. Menu</ThemedText>
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
                <ThemedText type="subtitle">1. Resume</ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Menu"
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.pauseAction, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.pauseButton}>
                <ThemedText type="subtitle">2. Menu</ThemedText>
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
    gap: Spacing.two,
  },
  toolbarButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    backgroundColor: '#E0E1E6',
  },
  timer: {
    marginRight: Spacing.three,
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
  },
  stackedCard: {
    position: 'absolute',
    left: 0,
  },
});
