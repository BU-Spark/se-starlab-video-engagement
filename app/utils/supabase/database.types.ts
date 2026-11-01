/**
 * app/utils/supabase/database.types.ts
 *
 * Row shapes of the Supabase tables shared by the researcher website and the tablet app.
 * Hand-written from the schema plus supabase/migrations; replace with
 * `supabase gen types typescript` output once the project is linked.
 */

export type BlockTypeValue = 'instructions' | 'video' | 'survey';

/** public.studies */
export interface StudyRow {
  id: string;
  name: string;
  /** true: every block is shuffled. false: blocks sharing a random_group are shuffled among themselves. */
  randomized: boolean;
  show_video_bar: boolean;
  show_response_buttons: boolean;
  left_button_text: string;
  right_button_text: string;
  /** Storage object path; null means the default thumbs-down icon. */
  left_button_icon_path: string | null;
  /** Storage object path; null means the default thumbs-up icon. */
  right_button_icon_path: string | null;
  allow_swipe_back: boolean;
  allow_pausing: boolean;
  comment_button: boolean;
  save_button: boolean;
  share_button: boolean;
  /** Pause the video while the share or comments panel is open. */
  pause_on_share: boolean;
  /** Share panel options in display order; null means the tablet's defaults. */
  share_options: string[] | null;
  audio_record: boolean;
  camera_record: boolean;
  created_at: string;
  updated_at: string;
}

export type StudyInsert = Omit<StudyRow, 'created_at' | 'updated_at'>;

/** One researcher-written comment shown in a video's comments panel (blocks.comments). */
export interface CommentJson {
  author: string;
  text: string;
  likes?: number;
}

/** public.blocks */
export interface BlockRow {
  id: string;
  study_id: string;
  position: number;
  type: BlockTypeValue;
  label: string;
  /** Used only when the study is not randomized; null keeps the block in place. */
  random_group: string | null;
  /** Instruction text (instructions blocks only). */
  body: string | null;
  /** Storage object path (video blocks only). */
  video_path: string | null;
  /** Original upload name (video blocks only). */
  file_name: string | null;
  /** Caption heading (video blocks only); null hides it. */
  title: string | null;
  /** Caption body (video blocks only); null hides it. */
  description: string | null;
  /** Comments panel content (video blocks only); null means "No comments yet". */
  comments: CommentJson[] | null;
  /** Survey question (survey blocks only). */
  prompt: string | null;
  /** Survey response bubbles in display order (survey blocks only). */
  options: string[] | null;
  created_at: string;
}

export type BlockInsert = Omit<BlockRow, 'created_at'>;

/** public.runs — one participant session on the tablet. */
export interface RunRow {
  id: string;
  study_id: string;
  participant_id: string;
  started_at: string;
  /** null while the participant has not finished the last block. */
  completed_at: string | null;
  synced_at: string;
}

/** public.block_views — one viewing of a block; swiping back creates another row. */
export interface BlockViewRow {
  id: number;
  run_id: string;
  block_id: string;
  view_order: number;
  stimulus: string;
  started_at: string;
  watch_time_ms: number;
  button_press: string | null;
  button_time_ms: number | null;
  video_start_at: string | null;
  video_end_at: string | null;
  swiped_back: boolean;
  /** ms from block start to the first share tap; null if never tapped. */
  share_time_ms: number | null;
  /** Share option picked, "Cancel", or null if the sheet was never opened. */
  share_choice: string | null;
  comment_time_ms: number | null;
  save_time_ms: number | null;
  /** Whether the video was saved when the participant left it. */
  saved: boolean;
}

/** Argument of public.submit_run(run jsonb): one run with its views, written atomically. */
export interface SubmitRunPayload {
  id: string;
  study_id: string;
  participant_id: string;
  started_at: string;
  completed_at: string | null;
  views: Omit<BlockViewRow, 'id' | 'run_id' | 'video_start_at' | 'video_end_at'>[];
}
