/**
 * app/types/study.types.ts
 *
 * Types shared by the participant tablet app and (later) the researcher website.
 * A Study is what the researcher builds; a RunResult is what one participant session produces.
 */

export interface StudyDisplaySettings {
  /** Show a progress bar for each video at the top of the screen */
  videoBar: boolean;
  /** Custom image URL for the left response button. Defaults to a thumbs down. */
  leftIcon?: string;
  /** Custom image URL for the right response button. Defaults to a thumbs up. */
  rightIcon?: string;
  /** Text shown below the left response button (default blank) */
  leftText: string;
  /** Text shown below the right response button (default blank) */
  rightText: string;
}

export interface StudyControlSettings {
  /** Allow swiping back to the previous block */
  swipeUp: boolean;
  /** Show the left/right response buttons over videos */
  responseButtons: boolean;
  /** Allow tapping a video to pause/resume */
  pausing: boolean;
  /** Low priority, not implemented yet */
  audioRecord: boolean;
  /** Low priority, not implemented yet */
  cameraRecord: boolean;
}

interface BaseBlock {
  id: string;
  /** Name used in the data output, e.g. "instruction1" */
  label: string;
  /**
   * Advanced randomization: blocks sharing a randomGroup are shuffled among themselves
   * while every other block keeps its position.
   */
  randomGroup?: string;
}

export interface InstructionsBlock extends BaseBlock {
  type: 'instructions';
  text: string;
}

export interface VideoBlock extends BaseBlock {
  type: 'video';
  videoUrl: string;
  fileName: string;
}

export interface SurveyBlock extends BaseBlock {
  type: 'survey';
  prompt: string;
  options: string[];
}

export type Block = InstructionsBlock | VideoBlock | SurveyBlock;

export interface Study {
  id: string;
  name: string;
  /** Shuffle all blocks. When off, randomGroup (if set) still shuffles within groups. */
  randomized: boolean;
  display: StudyDisplaySettings;
  controls: StudyControlSettings;
  blocks: Block[];
}

export type ButtonSide = 'Left' | 'Right';

/** One row per viewing of a block. Returning to a block creates a new row. */
export interface BlockResult {
  blockId: string;
  /** 1-based position of this row in the session */
  order: number;
  /** Block label, or the video file name for video blocks */
  stimulus: string;
  /** Milliseconds from the block appearing to the participant swiping away */
  watchTimeMs: number;
  /** 1 if the participant left this block by swiping back to the previous one */
  swipedUp: 0 | 1;
  /** Left/Right for videos, the chosen option text for surveys */
  buttonPress: string | null;
  /** Milliseconds from block start to the button press (videos) or first bubble touch (surveys) */
  buttonTimeMs: number | null;
  startedAtIso: string;
}

export interface RunResult {
  studyId: string;
  studyName: string;
  participantId: string;
  startedAtIso: string;
  completedAtIso: string;
  /** Block ids in the order this participant saw them (differs per run when randomized) */
  blockOrder: string[];
  rows: BlockResult[];
}
