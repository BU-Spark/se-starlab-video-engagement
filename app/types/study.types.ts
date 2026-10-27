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
  /** Share targets listed when the share button is tapped. Defaults to Copy link, Messages, Email, Repost, More. */
  shareOptions?: string[];
}

export interface StudyControlSettings {
  /** Allow swiping back to the previous block */
  swipeUp: boolean;
  /** Show the left/right response buttons over videos */
  responseButtons: boolean;
  /**
   * Extra TikTok/Reels-style buttons on the right-hand rail, each switched on or off per study.
   * Omitted counts as off, so older studies keep working.
   */
  /** Comment opens a panel with the video's `comments`; the first tap time is recorded */
  commentButton?: boolean;
  /** Save toggles on/off like TikTok; the first tap time and the final saved state are recorded */
  saveButton?: boolean;
  /** Share opens a share sheet; the tap time and the option picked are recorded */
  shareButton?: boolean;
  /**
   * Pause the video while the share or comments panel is open.
   * Off by default: it keeps playing, as in Shorts/Reels. (Named before comments opened a panel too.)
   */
  pauseOnShare?: boolean;
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

/** A comment the researcher writes for a video; shown in the comments panel, read-only */
export interface VideoComment {
  author: string;
  text: string;
  /** Like count shown next to the comment; omit to hide */
  likes?: number;
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
  /** Comments listed when the comment button is tapped; omit for "No comments yet" */
  comments?: VideoComment[];
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
  /** Milliseconds from block start to the first tap on the share button, or null if never tapped */
  shareTimeMs: number | null;
  /** Share option picked, "Cancel" if the sheet was only dismissed, or null if never opened */
  shareChoice: string | null;
  /** Milliseconds from block start to the first tap on the comment button, or null if never tapped */
  commentTimeMs: number | null;
  /** Milliseconds from block start to the first tap on the save button, or null if never tapped */
  saveTimeMs: number | null;
  /** 1 if the video was saved when the participant left it */
  saved: 0 | 1;
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
