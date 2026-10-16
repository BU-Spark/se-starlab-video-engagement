/**
 * app/utils/runner/runnerReducer.ts
 *
 * Steps a participant through the ordered blocks and records one BlockResult per viewing.
 * Timestamps are passed in with each action (from performance.now()) so the reducer stays pure
 * and the timing logic can be tested with fake clocks.
 */

import type { Block, BlockResult, ButtonSide } from '@/app/types';

interface CurrentViewing {
  blockId: string;
  /** performance.now() when the block appeared */
  startedAt: number;
  startedAtIso: string;
  buttonPress: string | null;
  /** ms from startedAt to the (first) response */
  buttonTimeMs: number | null;
}

export interface RunnerState {
  blocks: Block[];
  index: number;
  current: CurrentViewing | null;
  rows: BlockResult[];
  finished: boolean;
}

export type RunnerAction =
  | { type: 'start'; now: number; iso: string }
  | { type: 'next'; now: number; iso: string }
  | { type: 'previous'; now: number; iso: string }
  | { type: 'button'; side: ButtonSide; now: number }
  | { type: 'bubble'; option: string; now: number };

export function createRunnerState(blocks: Block[]): RunnerState {
  return { blocks, index: 0, current: null, rows: [], finished: false };
}

function stimulusFor(block: Block): string {
  return block.type === 'video' ? block.fileName : block.label;
}

function beginViewing(block: Block, now: number, iso: string): CurrentViewing {
  return { blockId: block.id, startedAt: now, startedAtIso: iso, buttonPress: null, buttonTimeMs: null };
}

function finishViewing(state: RunnerState, now: number, swipedUp: 0 | 1): BlockResult[] {
  const { current } = state;
  if (!current) return state.rows;
  const block = state.blocks[state.index];
  return [
    ...state.rows,
    {
      blockId: current.blockId,
      order: state.rows.length + 1,
      stimulus: stimulusFor(block),
      watchTimeMs: Math.round(now - current.startedAt),
      swipedUp,
      buttonPress: current.buttonPress,
      buttonTimeMs: current.buttonTimeMs,
      startedAtIso: current.startedAtIso,
    },
  ];
}

export function runnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  if (state.finished) return state;

  switch (action.type) {
    case 'start':
      if (state.current || state.blocks.length === 0) return state;
      return { ...state, current: beginViewing(state.blocks[0], action.now, action.iso) };

    case 'next': {
      if (!state.current) return state;
      const rows = finishViewing(state, action.now, 0);
      const nextIndex = state.index + 1;
      if (nextIndex >= state.blocks.length) {
        return { ...state, rows, current: null, finished: true };
      }
      return {
        ...state,
        rows,
        index: nextIndex,
        current: beginViewing(state.blocks[nextIndex], action.now, action.iso),
      };
    }

    case 'previous': {
      if (!state.current || state.index === 0) return state;
      const rows = finishViewing(state, action.now, 1);
      const prevIndex = state.index - 1;
      return {
        ...state,
        rows,
        index: prevIndex,
        current: beginViewing(state.blocks[prevIndex], action.now, action.iso),
      };
    }

    case 'button': {
      // Video response buttons: only the first press counts and it cannot be switched.
      if (!state.current || state.current.buttonPress !== null) return state;
      return {
        ...state,
        current: {
          ...state.current,
          buttonPress: action.side,
          buttonTimeMs: Math.round(action.now - state.current.startedAt),
        },
      };
    }

    case 'bubble': {
      // Survey bubbles: the latest choice wins, but the time is of the first touch.
      if (!state.current) return state;
      return {
        ...state,
        current: {
          ...state.current,
          buttonPress: action.option,
          buttonTimeMs: state.current.buttonTimeMs ?? Math.round(action.now - state.current.startedAt),
        },
      };
    }

    default:
      return state;
  }
}
