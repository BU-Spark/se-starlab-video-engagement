'use client';

import { useCallback, useReducer } from 'react';
import type { Block, LikeDislike } from '@/app/types';
import { createRunnerState, runnerReducer, wallClockIso } from '@/app/utils/runner';

/**
 * useBlockRunner.ts
 *
 * Wires runnerReducer to the real clock. Every function takes an optional timestamp:
 * pass the input event's `event.timeStamp` (same clock as performance.now()) so response
 * times reflect when the finger touched the screen, not when React got around to handling it.
 */
function useBlockRunner(blocks: Block[]) {
  const [state, dispatch] = useReducer(runnerReducer, blocks, createRunnerState);

  const start = useCallback(
    (at = performance.now()) => dispatch({ type: 'start', now: at, iso: wallClockIso(at) }),
    []
  );
  const next = useCallback((at = performance.now()) => dispatch({ type: 'next', now: at, iso: wallClockIso(at) }), []);
  const previous = useCallback(
    (at = performance.now()) => dispatch({ type: 'previous', now: at, iso: wallClockIso(at) }),
    []
  );
  const pressButton = useCallback(
    (choice: LikeDislike, at = performance.now()) => dispatch({ type: 'button', choice, now: at }),
    []
  );
  const chooseBubble = useCallback(
    (option: string, at = performance.now()) => dispatch({ type: 'bubble', option, now: at }),
    []
  );

  const videoPlaying = useCallback(
    (blockId: string, at = performance.now()) => dispatch({ type: 'videoPlaying', blockId, iso: wallClockIso(at) }),
    []
  );
  const pauseVideo = useCallback(
    (blockId: string, at = performance.now()) => dispatch({ type: 'pause', blockId, now: at }),
    []
  );
  const resumeVideo = useCallback(
    (blockId: string, at = performance.now()) => dispatch({ type: 'resume', blockId, now: at }),
    []
  );

  return {
    state,
    start,
    next,
    previous,
    pressButton,
    chooseBubble,
    videoPlaying,
    pauseVideo,
    resumeVideo,
  };
}

export default useBlockRunner;
