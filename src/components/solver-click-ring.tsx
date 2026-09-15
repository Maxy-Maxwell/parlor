import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { ClickTarget, GameState } from '@/game/solitaire';

export const SOLVER_RING_MS = 500;
/** Apply the solver move this far into the ring animation. */
export const SOLVER_ACTION_AT_MS = SOLVER_RING_MS / 2;
const GOLD = '#FFD700';

type SlotFrame = { x: number; y: number; width: number; height: number };
type Pulse = { token: number; ids: ReadonlySet<string> };
type SlotNode = { node: View; sticky: boolean };
type RingItem = {
  id: string;
  frame: SlotFrame;
  sticky: boolean;
  scrollY: number;
};

type SlotBoardContextValue = {
  register: (id: string, node: View | null, sticky: boolean) => void;
  scrollY: SharedValue<number>;
};

const SlotBoardContext = createContext<SlotBoardContextValue | null>(null);

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
  stickyOffset = 0,
}: {
  pulse: Pulse | null;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
  stickyOffset?: number;
}) {
  const boardRef = useRef<View>(null);
  const slots = useRef(new Map<string, SlotNode>());
  const scrollY = useSharedValue(0);
  const [rings, setRings] = useState<{ token: number; items: RingItem[] } | null>(null);

  const register = useCallback((id: string, node: View | null, sticky: boolean) => {
    if (node) {
      slots.current.set(id, { node, sticky });
      return;
    }
    slots.current.delete(id);
  }, []);

  const ctx = useMemo(() => ({ register, scrollY }), [register, scrollY]);

  useLayoutEffect(() => {
    if (pulse == null) {
      setRings(null);
      return;
    }

    let cancelled = false;
    let raf = 0;

    const measure = (id: string, done: (item: RingItem | null) => void) => {
      const slot = slots.current.get(id);
      const board = boardRef.current;
      if (!slot || !board) {
        done(null);
        return;
      }

      const apply = (x: number, y: number, width: number, height: number) => {
        if (width <= 0 || height <= 0) {
          done(null);
          return;
        }
        done({
          id,
          frame: { x, y, width, height },
          sticky: slot.sticky,
          scrollY: scrollY.value,
        });
      };

      slot.node.measureInWindow((sx, sy, sw, sh) => {
        board.measureInWindow((bx, by) => {
          apply(sx - bx, sy - by, sw, sh);
        });
      });
    };

    const collect = (done: (items: RingItem[]) => void) => {
      const ids = [...pulse.ids];
      if (ids.length === 0) {
        done([]);
        return;
      }

      let remaining = ids.length;
      const items: RingItem[] = [];
      const finish = (item: RingItem | null) => {
        if (item) {
          items.push(item);
        }
        remaining -= 1;
        if (remaining <= 0) {
          done(items);
        }
      };

      for (const id of ids) {
        measure(id, finish);
      }
    };

    collect((items) => {
      if (cancelled) {
        return;
      }
      setRings({ token: pulse.token, items });
      if (items.length >= pulse.ids.size) {
        return;
      }
      raf = requestAnimationFrame(() => {
        collect((retryItems) => {
          if (!cancelled) {
            setRings({ token: pulse.token, items: retryItems });
          }
        });
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [pulse, scrollY]);

  return (
    <SlotBoardContext.Provider value={ctx}>
      <View
        ref={boardRef}
        collapsable={false}
        style={style}
        onLayout={onLayout}>
        {children}
        {rings?.items.map((item) => (
          <SolverRingOverlay
            key={`${rings.token}-${item.id}`}
            frame={item.frame}
            sticky={item.sticky}
            snapshotScrollY={item.scrollY}
            scrollY={scrollY}
            stickyOffset={stickyOffset}
          />
        ))}
      </View>
    </SlotBoardContext.Provider>
  );
}

export function SlotBoardScrollView({ scrollEventThrottle, ...props }: ScrollViewProps) {
  const ctx = useContext(SlotBoardContext);
  const fallbackScrollY = useSharedValue(0);
  const scrollY = ctx?.scrollY ?? fallbackScrollY;
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return (
    <Animated.ScrollView
      {...props}
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle ?? 16}
    />
  );
}

export function SlotAnchor({
  slotId,
  sticky = false,
  children,
  style,
}: {
  slotId: string;
  sticky?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ctx = useContext(SlotBoardContext);

  const setRef = useCallback(
    (node: View | null) => {
      ctx?.register(slotId, node, sticky);
    },
    [ctx, slotId, sticky],
  );

  return (
    <View ref={setRef} collapsable={false} style={[styles.anchor, style]}>
      {children}
    </View>
  );
}

function SolverRingOverlay({
  frame,
  sticky,
  snapshotScrollY,
  scrollY,
  stickyOffset,
}: {
  frame: SlotFrame;
  sticky: boolean;
  snapshotScrollY: number;
  scrollY: SharedValue<number>;
  stickyOffset: number;
}) {
  const wrapStyle = useAnimatedStyle(() => {
    const current = scrollY.value;
    const delta = sticky
      ? Math.min(current, stickyOffset) - Math.min(snapshotScrollY, stickyOffset)
      : current - snapshotScrollY;
    return {
      left: frame.x,
      top: frame.y - delta,
      width: frame.width,
      height: frame.height,
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.ringWrap, wrapStyle]}>
      <SolverClickRing />
    </Animated.View>
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
  ringWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 50,
    elevation: 50,
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
