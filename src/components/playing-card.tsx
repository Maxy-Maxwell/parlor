import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RANK_LABELS, SUIT_LABELS, type Card, type Suit } from '@/game/solitaire';

export const BASE_CARD_WIDTH = 48;
export const CARD_ASPECT = 68 / 48;
export const FACE_UP_PEEK_RATIO = 24 / 68;
export const FACE_DOWN_PEEK_RATIO = 10 / 68;

const RED = { ink: '#c62828', wash: '#fdecec', border: '#e39b9b' };
const BLACK = { ink: '#212121', wash: '#f1f1f1', border: '#9e9e9e' };

const SUIT_THEME: Record<Suit, { ink: string; wash: string; border: string }> = {
  hearts: RED,
  diamonds: RED,
  clubs: BLACK,
  spades: BLACK,
};

export function SolitaireCard({
  card,
  faceDown = false,
  emptyHint,
  faceDownLabel,
  selected = false,
  accessibilityLabel,
  onPress,
  width = BASE_CARD_WIDTH,
}: {
  card?: Card;
  faceDown?: boolean;
  emptyHint?: string;
  faceDownLabel?: string;
  selected?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
  width?: number;
}) {
  const theme = card ? SUIT_THEME[card.suit] : null;
  const scale = width / BASE_CARD_WIDTH;
  const height = width * CARD_ASPECT;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          height,
          borderRadius: Math.max(4, 6 * scale),
        },
        faceDown && styles.faceDown,
        !card && !faceDown && styles.emptyCard,
        theme && { backgroundColor: theme.wash, borderColor: theme.border },
        selected && [styles.selected, { borderWidth: Math.max(2, 3 * scale) }],
        pressed && styles.pressed,
      ]}>
      {faceDown ? (
        <Text style={[styles.faceDownText, { fontSize: 14 * scale }]}>{faceDownLabel}</Text>
      ) : card && theme ? (
        <CardFace card={card} ink={theme.ink} scale={scale} />
      ) : (
        <Text style={[styles.emptyText, { fontSize: 12 * scale }]}>{emptyHint}</Text>
      )}
    </Pressable>
  );
}

function CardFace({ card, ink, scale }: { card: Card; ink: string; scale: number }) {
  const suit = SUIT_LABELS[card.suit];
  const rankSize = (card.rank === 10 ? 10 : 12) * scale;
  const pipSize = 10 * scale;
  const centerSize = 22 * scale;

  return (
    <View style={styles.face}>
      <View style={[styles.corner, { top: 2 * scale, left: 3 * scale }]}>
        <Text style={[styles.rank, { color: ink, fontSize: rankSize, lineHeight: rankSize + scale }]}>
          {RANK_LABELS[card.rank]}
        </Text>
        <Text style={[styles.cornerPip, { color: ink, fontSize: pipSize, lineHeight: pipSize + scale }]}>
          {suit}
        </Text>
      </View>
      <Text
        style={[
          styles.centerPip,
          {
            color: ink,
            fontSize: centerSize,
            lineHeight: centerSize + 2 * scale,
            right: 4 * scale,
            bottom: 2 * scale,
          },
        ]}>
        {suit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#c5c6cb',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: '#b0b4ba',
  },
  faceDown: {
    backgroundColor: '#1f4e8c',
    borderColor: '#163a68',
  },
  selected: {
    borderColor: '#3c87f7',
  },
  pressed: {
    opacity: 0.75,
  },
  face: {
    width: '100%',
    height: '100%',
  },
  corner: {
    position: 'absolute',
    alignItems: 'center',
    minWidth: 14,
  },
  rank: {
    fontWeight: '700',
  },
  cornerPip: {},
  centerPip: {
    position: 'absolute',
  },
  faceDownText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  emptyText: {
    color: '#8a8d93',
    fontWeight: '500',
  },
});
