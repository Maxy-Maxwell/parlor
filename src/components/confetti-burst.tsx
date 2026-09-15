import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const CONFETTI_MS = 5000;
const PIECE_COUNT = 56;
const COLORS = ['#FF4D6D', '#FFD166', '#06D6A0', '#4CC9F0', '#C77DFF', '#F72585', '#FF9F1C'];

type Piece = {
  color: string;
  delay: number;
  duration: number;
  height: number;
  rotate: number;
  width: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createPieces(width: number, height: number): Piece[] {
  return Array.from({ length: PIECE_COUNT }, () => {
    const delay = randomBetween(0, 400);
    const duration = Math.min(CONFETTI_MS - delay, randomBetween(2800, 4600));
    const x0 = randomBetween(0, width);
    return {
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay,
      duration,
      height: randomBetween(8, 14),
      rotate: randomBetween(-720, 720),
      width: randomBetween(6, 12),
      x0,
      x1: x0 + randomBetween(-120, 120),
      y0: randomBetween(-24, -8),
      y1: height + randomBetween(24, 80),
    };
  });
}

export function ConfettiBurst({ onComplete }: { onComplete?: () => void }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(() => createPieces(width, height), [height, width]);

  useEffect(() => {
    const timeout = setTimeout(() => onComplete?.(), CONFETTI_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <View pointerEvents="none" style={styles.layer}>
      {pieces.map((piece, index) => (
        <ConfettiPiece key={index} piece={piece} />
      ))}
    </View>
  );
}

function ConfettiPiece({ piece }: { piece: Piece }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, {
        duration: piece.duration,
        easing: Easing.out(Easing.quad),
      }),
    );
  }, [piece.delay, piece.duration, progress]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const fade = t < 0.82 ? 1 : Math.max(0, (1 - t) / 0.18);
    return {
      opacity: fade,
      transform: [
        { translateX: piece.x0 + (piece.x1 - piece.x0) * t },
        { translateY: piece.y0 + (piece.y1 - piece.y0) * t },
        { rotate: `${piece.rotate * t}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: piece.width,
          height: piece.height,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 200,
    elevation: 200,
    overflow: 'hidden',
  },
  piece: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 2,
  },
});
