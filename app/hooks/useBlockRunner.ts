'use client';

import { useCallback, useReducer } from 'react';
import type { Block, ButtonSide } from '@/app/types';
import { createRunnerState, runnerReducer } from '@/app/utils/runner';

/**
 * useBlockRunner.ts
 *
 * Wires runnerReducer to the real clock. Every function takes an optional timestamp:
 * pass the input event's `event.timeStamp` (same clock as performance.now()) so response
 * times reflect when the finger touched the screen, not when React got around to handling it.
 */
function useBlockRunner(blocks: Block[]) {
  const [state, dispatch] = useReducer(runnerReducer, blocks, createRunnerState);

  const iso = () => new Date().toISOString();

  const start = useCallback((at = performance.now()) => dispatch({ type: 'start', now: at, iso: iso() }), []);
  const next = useCallback((at = performance.now()) => dispatch({ type: 'next', now: at, iso: iso() }), []);
  const previous = useCallback((at = performance.now()) => dispatch({ type: 'previous', now: at, iso: iso() }), []);
  const pressButton = useCallback(
    (side: ButtonSide, at = performance.now()) => dispatch({ type: 'button', side, now: at }),
    []
  );
  const chooseBubble = useCallback(
    (option: string, at = performance.now()) => dispatch({ type: 'bubble', option, now: at }),
    []
  );

  return { state, start, next, previous, pressButton, chooseBubble };
}

export default useBlockRunner;
