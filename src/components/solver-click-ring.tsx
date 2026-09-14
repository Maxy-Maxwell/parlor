import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { ClickTarget, GameState } from '@/game/solitaire';

export const SOLVER_RING_MS = 500;
/** Apply the solver move this far into the ring animation. */
export const SOLVER_ACTION_AT_MS = SOLVER_RING_MS / 2;
const GOLD = '#FFD700';

type SlotFrame = { x: number; y: number; width: number; height: number };
type Pulse = { token: number; ids: ReadonlySet<string> };

type SlotBoardContextValue = {
  boardRef: RefObject<View | null>;
  frames: MutableRefObject<Map<string, SlotFrame>>;
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
}: {
  pulse: Pulse | null;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const boardRef = useRef<View>(null);
  const frames = useRef(new Map<string, SlotFrame>());
  const ctx = useMemo(() => ({ boardRef, frames }), []);
  const [rings, setRings] = useState<{ token: number; items: { id: string; frame: SlotFrame }[] } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (pulse == null) {
      setRings(null);
      return;
    }

    const collect = () => {
      const items: { id: string; frame: SlotFrame }[] = [];
      for (const id of pulse.ids) {
        const frame = frames.current.get(id);
        if (frame && frame.width > 0 && frame.height > 0) {
          items.push({ id, frame: { ...frame } });
        }
      }
      return items;
    };

    const items = collect();
    setRings({ token: pulse.token, items });
    if (items.length >= pulse.ids.size) {
      return;
    }

    const raf = requestAnimationFrame(() => {
      setRings({ token: pulse.token, items: collect() });
    });
    return () => cancelAnimationFrame(raf);
  }, [pulse]);

  return (
    <SlotBoardContext.Provider value={ctx}>
      <View
        ref={boardRef}
        collapsable={false}
        style={style}
        onLayout={onLayout}>
        {children}
        {rings?.items.map(({ id, frame }) => (
          <View
            key={`${rings.token}-${id}`}
            pointerEvents="none"
            style={[
              styles.ringWrap,
              {
                left: frame.x,
                top: frame.y,
                width: frame.width,
                height: frame.height,
              },
            ]}>
            <SolverClickRing />
          </View>
        ))}
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
  const ctx = useContext(SlotBoardContext);
  const ref = useRef<View>(null);

  const report = useCallback(() => {
    const slot = ref.current;
    const board = ctx?.boardRef.current;
    if (!slot || !board || !ctx) {
      return;
    }
    slot.measureLayout(
      board,
      (x, y, width, height) => {
        if (width <= 0 || height <= 0) {
          return;
        }
        ctx.frames.current.set(slotId, { x, y, width, height });
      },
      () => {
        slot.measureInWindow((sx, sy, sw, sh) => {
          board.measureInWindow((bx, by) => {
            if (sw <= 0 || sh <= 0) {
              return;
            }
            ctx.frames.current.set(slotId, {
              x: sx - bx,
              y: sy - by,
              width: sw,
              height: sh,
            });
          });
        });
      },
    );
  }, [ctx, slotId]);

  useLayoutEffect(() => {
    report();
  }, [report]);

  return (
    <View ref={ref} collapsable={false} style={[styles.anchor, style]} onLayout={report}>
      {children}
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
