/**
 * Row shapes for the Supabase tables the researcher builder writes.
 * Hand-written from the agreed schema; replace with `supabase gen types typescript`
 * output once the project is linked so the compiler catches schema drift.
 */

export type BlockTypeValue = 'instruction' | 'video' | 'survey';

/** public.studies */
export interface StudyRow {
  id: string;
  name: string;
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
  created_at: string;
  updated_at: string;
}

export type StudyInsert = Omit<StudyRow, 'created_at' | 'updated_at'>;

/** public.blocks */
export interface BlockRow {
  id: string;
  study_id: string;
  position: number;
  type: BlockTypeValue;
  label: string;
  /** Blocks sharing a group are shuffled among their own positions when the study is randomized. */
  random_group: string | null;
  /** Instruction text (instruction blocks only). */
  body: string | null;
  /** Storage object path (video blocks only). */
  video_path: string | null;
  /** Original upload name (video blocks only). */
  file_name: string | null;
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
}
