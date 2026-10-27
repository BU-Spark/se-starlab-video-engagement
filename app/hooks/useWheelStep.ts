'use client';

import { useCallback, useRef, type WheelEvent } from 'react';

export type WheelStep = 'next' | 'previous';

/** Scroll distance (px) that counts as one step */
const STEP_THRESHOLD_PX = 40;
/** A pause this long between wheel events ends the gesture, unlocking the next step */
const QUIET_MS = 250;
/** No new step sooner than this after the last one (roughly the slide animation) */
const MIN_STEP_GAP_MS = 350;
/** During inertia the deltas only shrink; a jump this much bigger means the fingers swiped again */
const NEW_SWIPE_RATIO = 1.5;
const NEW_SWIPE_MIN_PX = 4;
const LINE_HEIGHT_PX = 16;

/**
 * useWheelStep.ts
 *
 * Turns mouse-wheel and trackpad scrolling into one slide step per gesture, like YouTube Shorts.
 * Trackpads keep firing wheel events from inertia after the fingers lift, so after a step the
 * hook stays locked until the events stop for QUIET_MS, or until the deltas grow again or change
 * direction, which only happens when the participant swipes again mid-inertia.
 */
function useWheelStep(onStep: (step: WheelStep, timeStamp: number) => void) {
  const accumulated = useRef(0);
  const locked = useRef(false);
  const lastAt = useRef(-Infinity);
  const lastDelta = useRef(0);
  const lastStepAt = useRef(-Infinity);

  return useCallback(
    (e: WheelEvent<HTMLElement>) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // sideways scroll
      const delta = e.deltaMode === 1 ? e.deltaY * LINE_HEIGHT_PX : e.deltaY;
      if (delta === 0) return;

      const quiet = e.timeStamp - lastAt.current > QUIET_MS;
      const swipedAgain =
        locked.current &&
        e.timeStamp - lastStepAt.current > MIN_STEP_GAP_MS &&
        (Math.sign(delta) !== Math.sign(lastDelta.current) ||
          Math.abs(delta) > Math.abs(lastDelta.current) * NEW_SWIPE_RATIO + NEW_SWIPE_MIN_PX);
      if (quiet || swipedAgain) {
        locked.current = false;
        accumulated.current = 0;
      }
      lastAt.current = e.timeStamp;
      lastDelta.current = delta;
      if (locked.current) return;

      accumulated.current += delta;
      if (Math.abs(accumulated.current) >= STEP_THRESHOLD_PX) {
        locked.current = true;
        lastStepAt.current = e.timeStamp;
        onStep(accumulated.current > 0 ? 'next' : 'previous', e.timeStamp);
      }
    },
    [onStep]
  );
}

export default useWheelStep;
