/**
 * app/types/study.types.ts
 *
 * Types shared by the participant tablet app and (later) the researcher website.
 * A Study is what the researcher builds; a RunResult is what one participant session produces.
 */

export interface StudyDisplaySettings {
  /** Show a progress bar for each video along the bottom of the screen */
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
  /** Record the microphone for the whole session (uploaded with the run) */
  audioRecord: boolean;
  /** Record the front camera for the whole session (one file with the audio when both are on) */
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
  /**
   * Caption shown over the bottom-left of the video, like a TikTok/Reels post.
   * Both are plain text set per video by the researcher; leave blank or omit to hide.
   */
  title?: string;
  /** Longer caption text under the title. Line breaks are kept; long text is clamped to a few lines. */
  description?: string;
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

/** The video response buttons: Like is the top (thumbs-up) button, Dislike the bottom one. */
export type LikeDislike = 'Like' | 'Dislike';

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
  /** Video blocks: Like or Dislike (the first press only); null if neither was pressed */
  likeDislike: LikeDislike | null;
  /** Milliseconds from block start to the Like/Dislike press */
  likeDislikeTimeMs: number | null;
  /** Survey blocks: the option text picked (the last choice wins); null if none */
  surveyAnswer: string | null;
  /** Milliseconds from block start to the first touch on an option */
  surveyTimeMs: number | null;
  /** System clock time the video actually started playing (first `playing` event); null for other blocks */
  videoStartAtIso: string | null;
  /**
   * System clock time the participant left the video. Videos loop, so leaving is the end of watching;
   * null when the video never started playing.
   */
  videoEndAtIso: string | null;
  /** Times the participant tapped to pause this video */
  pauseCount: number;
  /** Total ms the video stayed paused by those taps */
  pausedMs: number;
  startedAtIso: string;
}

/** The session's audio/camera recording; the file itself is kept on the tablet until it is uploaded. */
export interface RunRecording {
  mimeType: string;
  /** System clock time the recorder started, to line the recording up with the block timestamps */
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
  /** Present when the study records audio or camera and the recorder ran */
  recording?: RunRecording;
}
