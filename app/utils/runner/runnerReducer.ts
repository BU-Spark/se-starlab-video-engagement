/**
 * app/utils/runner/runnerReducer.ts
 *
 * Steps a participant through the ordered blocks and records one BlockResult per viewing.
 * Timestamps are passed in with each action (from performance.now()) so the reducer stays pure
 * and the timing logic can be tested with fake clocks. Actions that need the system clock also carry
 * an ISO string computed by the caller from the same instant.
 */

import type { Block, BlockResult, LikeDislike } from '@/app/types';

interface CurrentViewing {
  blockId: string;
  /** performance.now() when the block appeared */
  startedAt: number;
  startedAtIso: string;
  likeDislike: LikeDislike | null;
  likeDislikeTimeMs: number | null;
  surveyAnswer: string | null;
  /** ms from startedAt to the first survey option touch */
  surveyTimeMs: number | null;
  /** System clock time of the first `playing` event of this viewing */
  videoStartIso: string | null;
  pauseCount: number;
  /** Paused time of pauses that already ended */
  pausedMs: number;
  /** performance.now() of the pause in progress, if any */
  pausedAt: number | null;
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
  | { type: 'button'; choice: LikeDislike; now: number }
  | { type: 'bubble'; option: string; now: number }
  // Video events carry the block id: a late media event must not land on the block shown after it.
  | { type: 'videoPlaying'; blockId: string; iso: string }
  | { type: 'pause'; blockId: string; now: number }
  | { type: 'resume'; blockId: string; now: number };

export function createRunnerState(blocks: Block[]): RunnerState {
  return { blocks, index: 0, current: null, rows: [], finished: false };
}

function stimulusFor(block: Block): string {
  return block.type === 'video' ? block.fileName : block.label;
}

function beginViewing(block: Block, now: number, iso: string): CurrentViewing {
  return {
    blockId: block.id,
    startedAt: now,
    startedAtIso: iso,
    likeDislike: null,
    likeDislikeTimeMs: null,
    surveyAnswer: null,
    surveyTimeMs: null,
    videoStartIso: null,
    pauseCount: 0,
    pausedMs: 0,
    pausedAt: null,
  };
}

function finishViewing(state: RunnerState, now: number, iso: string, swipedUp: 0 | 1): BlockResult[] {
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
      likeDislike: current.likeDislike,
      likeDislikeTimeMs: current.likeDislikeTimeMs,
      surveyAnswer: current.surveyAnswer,
      surveyTimeMs: current.surveyTimeMs,
      videoStartAtIso: current.videoStartIso,
      // Videos loop, so the end of watching is when the participant leaves.
      videoEndAtIso: current.videoStartIso ? iso : null,
      pauseCount: current.pauseCount,
      // A pause still running when the participant swipes away counts up to that moment.
      pausedMs: current.pausedMs + (current.pausedAt === null ? 0 : Math.round(now - current.pausedAt)),
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
      const rows = finishViewing(state, action.now, action.iso, 0);
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
      const rows = finishViewing(state, action.now, action.iso, 1);
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
      if (!state.current || state.current.likeDislike !== null) return state;
      return {
        ...state,
        current: {
          ...state.current,
          likeDislike: action.choice,
          likeDislikeTimeMs: Math.round(action.now - state.current.startedAt),
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
          surveyAnswer: action.option,
          surveyTimeMs: state.current.surveyTimeMs ?? Math.round(action.now - state.current.startedAt),
        },
      };
    }

    case 'videoPlaying': {
      // The first playback start only; resuming after a pause or a loop does not move it.
      const { current } = state;
      if (!current || current.blockId !== action.blockId || current.videoStartIso !== null) return state;
      return { ...state, current: { ...current, videoStartIso: action.iso } };
    }

    case 'pause': {
      const { current } = state;
      if (!current || current.blockId !== action.blockId || current.pausedAt !== null) return state;
      return { ...state, current: { ...current, pauseCount: current.pauseCount + 1, pausedAt: action.now } };
    }

    case 'resume': {
      const { current } = state;
      if (!current || current.blockId !== action.blockId || current.pausedAt === null) return state;
      return {
        ...state,
        current: {
          ...current,
          pausedMs: current.pausedMs + Math.round(action.now - current.pausedAt),
          pausedAt: null,
        },
      };
    }

    default:
      return state;
  }
}
