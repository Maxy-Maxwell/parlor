import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { ClickTarget, GameState } from '@/game/solitaire';

export const SOLVER_RING_MS = 500;
/** Apply the solver move this far into the ring animation. */
export const SOLVER_ACTION_AT_MS = SOLVER_RING_MS / 2;
const GOLD = '#FFD700';

type Pulse = { token: number; ids: ReadonlySet<string> };

type SlotBoardContextValue = {
  pulse: Pulse | null;
};

const SlotBoardContext = createContext<SlotBoardContextValue>({ pulse: null });

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

export function SlotBoard({
  pulse,
  children,
  style,
  onLayout,
}: {
  pulse: Pulse | null;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const ctx = useMemo(() => ({ pulse }), [pulse]);

  return (
    <SlotBoardContext.Provider value={ctx}>
      <View collapsable={false} style={style} onLayout={onLayout}>
        {children}
      </View>
    </SlotBoardContext.Provider>
  );
}

export function SlotAnchor({
  slotId,
  children,
  style,
}: {
  slotId: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { pulse } = useContext(SlotBoardContext);
  const pulsing = pulse != null && pulse.ids.has(slotId);

  return (
    <View collapsable={false} style={[styles.anchor, style]}>
      {children}
      {pulsing && pulse ? (
        <View pointerEvents="none" style={styles.ringMount}>
          <SolverClickRing key={pulse.token} />
        </View>
      ) : null}
    </View>
  );
}

function SolverClickRing() {
  const progress = useSharedValue(0);

  useLayoutEffect(() => {
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

  return <Animated.View style={[styles.ring, style]} />;
}

const styles = StyleSheet.create({
  anchor: {
    position: 'relative',
    overflow: 'visible',
  },
  ringMount: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
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
