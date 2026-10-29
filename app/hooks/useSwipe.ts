'use client';

import { useCallback, useRef, useState, type PointerEvent } from 'react';

export type SwipeDirection = 'up' | 'down';

interface UseSwipeOptions {
  /** Called when a swipe completes. `timeStamp` is the pointerup event time (performance.now() clock). */
  onSwipe: (direction: SwipeDirection, timeStamp: number) => void;
  /** Return false to block a direction; the drag then only rubber-bands. */
  canSwipe?: (direction: SwipeDirection) => boolean;
}

/** Fraction of the element height a slow drag must cover to count as a swipe */
const DISTANCE_RATIO = 0.2;
/** A quick flick (px per ms) counts even if it is short */
const FLICK_VELOCITY = 0.5;
const FLICK_MIN_PX = 30;
/** Movement below this is treated as a tap, not a drag */
const TAP_SLOP_PX = 8;

/**
 * useSwipe.ts
 *
 * Vertical swipe detection with pointer events (works for touch and mouse) and a live drag
 * offset for the Reels-style follow-your-finger animation.
 */
function useSwipe({ onSwipe, canSwipe }: UseSwipeOptions) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; t: number; height: number } | null>(null);
  const moved = useRef(false);

  const directionOf = (dy: number): SwipeDirection => (dy < 0 ? 'up' : 'down');

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if (!e.isPrimary) return;
    start.current = { y: e.clientY, t: e.timeStamp, height: e.currentTarget.clientHeight || window.innerHeight };
    moved.current = false;
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (!start.current || !e.isPrimary) return;
      let dy = e.clientY - start.current.y;
      if (!moved.current && Math.abs(dy) > TAP_SLOP_PX) {
        moved.current = true;
        setDragging(true);
        // Only capture once it's clearly a drag, so taps on buttons still produce clicks.
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      if (!moved.current) return;
      if (canSwipe && !canSwipe(directionOf(dy))) dy *= 0.25;
      setDragY(dy);
    },
    [canSwipe]
  );

  const finish = useCallback(
    (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
      const begin = start.current;
      start.current = null;
      setDragging(false);
      setDragY(0);
      if (!begin || !moved.current || cancelled) return;

      const dy = e.clientY - begin.y;
      const velocity = Math.abs(dy) / Math.max(1, e.timeStamp - begin.t);
      const farEnough = Math.abs(dy) > begin.height * DISTANCE_RATIO;
      const flicked = velocity > FLICK_VELOCITY && Math.abs(dy) > FLICK_MIN_PX;
      const direction = directionOf(dy);
      if ((farEnough || flicked) && (!canSwipe || canSwipe(direction))) {
        onSwipe(direction, e.timeStamp);
      }
    },
    [canSwipe, onSwipe]
  );

  /** True if the last pointer sequence was a drag; use it to suppress the click that follows. */
  const wasDrag = useCallback(() => moved.current, []);

  return {
    dragY,
    dragging,
    wasDrag,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: PointerEvent<HTMLElement>) => finish(e, false),
      onPointerCancel: (e: PointerEvent<HTMLElement>) => finish(e, true),
    },
  };
}

export default useSwipe;
