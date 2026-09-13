import { useMemo, useState } from 'react';
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
import {
  TABLEAU_COUNT,
  formatCard,
  handleClick,
  isCardSelected,
  newGame,
  type Card,
  type GameState,
} from '@/game/solitaire';

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

export default function SolitaireScreen() {
  const [game, setGame] = useState<GameState>(() => newGame());
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const layout = useMemo(
    () => layoutCards(boardSize.width, boardSize.height),
    [boardSize.height, boardSize.width],
  );

  const status = useMemo(() => {
    if (game.won) {
      return 'You won.';
    }
    if (game.selected) {
      return 'Tap a pile to move, or tap the card again to cancel.';
    }
    return 'Tap a card, then tap where it should go. Tap the stock to draw.';
  }, [game.selected, game.won]);

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.toolbar}>
        <ThemedText type="small">{status}</ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New game"
          onPress={() => setGame(newGame())}
          style={({ pressed }) => [styles.newGame, pressed && styles.pressed]}>
          <ThemedText type="smallBold">New game</ThemedText>
        </Pressable>
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
                  onPress={() =>
                    setGame((current) => handleClick(current, { zone: 'foundation', pile: pileIndex }))
                  }
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
              onPress={() => setGame((current) => handleClick(current, { zone: 'waste' }))}
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
              onPress={() => setGame((current) => handleClick(current, { zone: 'stock' }))}
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
                      onPress={() =>
                        setGame((current) => handleClick(current, { zone: 'tableau', pile: pileIndex }))
                      }
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
                          onPress={() =>
                            setGame((current) =>
                              handleClick(current, { zone: 'tableau', pile: pileIndex, index }),
                            )
                          }
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
  newGame: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    backgroundColor: '#E0E1E6',
  },
  pressed: {
    opacity: 0.75,
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
