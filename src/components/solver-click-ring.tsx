import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { ClickTarget, GameState } from '@/game/solitaire';

export const SOLVER_RING_MS = 500;
/** Apply the solver move this far into the ring animation. */
export const SOLVER_ACTION_AT_MS = SOLVER_RING_MS / 2;
const GOLD = '#FFD700';

export function solverSlotId(target: ClickTarget, state: GameState): string {
  if (target.zone === 'stock') {
    return 'stock';
  }
  if (target.zone === 'waste') {
    return 'waste';
  }
  if (target.zone === 'foundation') {
    return `foundation-${target.pile}`;
  }
  const pile = state.tableau[target.pile];
  if (pile.length === 0) {
    return `tableau-${target.pile}-empty`;
  }
  const index = target.index ?? pile.length - 1;
  return `tableau-${target.pile}-${index}`;
}

export function SlotAnchor({
  slotId,
  pulse,
  children,
  style,
}: {
  slotId: string;
  pulse: { token: number; ids: ReadonlySet<string> } | null;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const active = pulse != null && pulse.ids.has(slotId);

  return (
    <View collapsable={false} style={[styles.anchor, style]}>
      {children}
      {active ? <SolverClickRing key={pulse.token} /> : null}
    </View>
  );
}

function SolverClickRing() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: SOLVER_RING_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - Math.max(0, progress.value - 0.35) / 0.65),
    transform: [{ scale: 0.08 + progress.value * 0.92 }],
  }));

  return (
    <View pointerEvents="none" style={styles.ringWrap}>
      <Animated.View style={[styles.ring, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    overflow: 'visible',
  },
  ringWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 30,
    elevation: 30,
  },
  ring: {
    width: '135%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: GOLD,
    backgroundColor: 'transparent',
  },
});
