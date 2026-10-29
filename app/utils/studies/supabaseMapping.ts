/**
 * app/utils/studies/supabaseMapping.ts
 *
 * The translation layer between the Supabase tables (written by the researcher website) and the
 * tablet's contract in app/types/study.types.ts. Pure functions only, so both directions are unit-tested.
 *
 *   studies + blocks rows  ──rowsToStudy──▶  Study        (tablet reads)
 *   RunResult              ──toSubmitRunPayload──▶ submit_run(run jsonb)  (tablet writes)
 */

import type { Block, BlockResult, RunResult, Study, VideoComment } from '@/app/types';
import type { BlockRow, StudyRow, SubmitRunPayload } from '@/app/utils/supabase/database.types';

/**
 * Storage path → downloadable URL (signed for a private bucket). Every referenced path must be present:
 * the tablet preloads all media before a session, so a missing file must fail before the participant starts.
 */
export type MediaUrls = Record<string, string>;

function urlFor(urls: MediaUrls, path: string): string {
  const url = urls[path];
  if (!url) throw new Error(`No download URL for "${path}". Check that the file exists in Storage.`);
  return url;
}

function toComments(comments: BlockRow['comments']): VideoComment[] | undefined {
  if (!comments?.length) return undefined;
  return comments.map((comment) => ({
    author: comment.author,
    text: comment.text,
    ...(typeof comment.likes === 'number' ? { likes: comment.likes } : {}),
  }));
}

function toBlock(row: BlockRow, urls: MediaUrls): Block {
  const base = { id: row.id, label: row.label, ...(row.random_group ? { randomGroup: row.random_group } : {}) };
  switch (row.type) {
    case 'video': {
      if (!row.video_path) throw new Error(`Video block "${row.label}" has no video file.`);
      const comments = toComments(row.comments);
      return {
        ...base,
        type: 'video',
        videoUrl: urlFor(urls, row.video_path),
        fileName: row.file_name || row.video_path.split('/').pop() || row.label,
        ...(row.title ? { title: row.title } : {}),
        ...(row.description ? { description: row.description } : {}),
        ...(comments ? { comments } : {}),
      };
    }
    case 'survey':
      return { ...base, type: 'survey', prompt: row.prompt ?? '', options: row.options ?? [] };
    default:
      // 'instructions'; rows saved before the type rename may still say 'instruction'.
      return { ...base, type: 'instructions', text: row.body ?? '' };
  }
}

/** Every Storage path the tablet needs a URL for. */
export function mediaPathsOf(study: StudyRow, blocks: BlockRow[]): string[] {
  const paths = [study.left_button_icon_path, study.right_button_icon_path, ...blocks.map((block) => block.video_path)];
  return [...new Set(paths.filter((path): path is string => !!path))];
}

export function rowsToStudy(study: StudyRow, blocks: BlockRow[], urls: MediaUrls): Study {
  const ordered = [...blocks].sort((a, b) => a.position - b.position);
  return {
    id: study.id,
    name: study.name,
    randomized: study.randomized,
    display: {
      videoBar: study.show_video_bar,
      leftText: study.left_button_text ?? '',
      rightText: study.right_button_text ?? '',
      ...(study.left_button_icon_path ? { leftIcon: urlFor(urls, study.left_button_icon_path) } : {}),
      ...(study.right_button_icon_path ? { rightIcon: urlFor(urls, study.right_button_icon_path) } : {}),
      ...(study.share_options?.length ? { shareOptions: study.share_options } : {}),
    },
    controls: {
      swipeUp: study.allow_swipe_back,
      responseButtons: study.show_response_buttons,
      commentButton: study.comment_button ?? false,
      saveButton: study.save_button ?? false,
      shareButton: study.share_button ?? false,
      pauseOnShare: study.pause_on_share ?? false,
      pausing: study.allow_pausing,
      audioRecord: study.audio_record ?? false,
      cameraRecord: study.camera_record ?? false,
    },
    blocks: ordered.map((row) => toBlock(row, urls)),
  };
}

const ms = (value: number | null) => (value === null ? null : Math.round(value));

function toView(row: BlockResult): SubmitRunPayload['views'][number] {
  return {
    block_id: row.blockId,
    view_order: row.order,
    stimulus: row.stimulus,
    started_at: row.startedAtIso,
    watch_time_ms: Math.round(row.watchTimeMs),
    button_press: row.buttonPress,
    button_time_ms: ms(row.buttonTimeMs),
    swiped_back: row.swipedUp === 1,
    share_time_ms: ms(row.shareTimeMs),
    share_choice: row.shareChoice,
    comment_time_ms: ms(row.commentTimeMs),
    save_time_ms: ms(row.saveTimeMs),
    saved: row.saved === 1,
  };
}

export function toSubmitRunPayload(run: RunResult, runId: string): SubmitRunPayload {
  return {
    id: runId,
    study_id: run.studyId,
    participant_id: run.participantId,
    started_at: run.startedAtIso,
    completed_at: run.completedAtIso || null,
    views: run.rows.map(toView),
  };
}

/** cyrb128: a fast, well-mixed 128-bit non-cryptographic string hash (public domain). */
function hash128(input: string): number[] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * A stable run ID derived from the session itself (study, participant, start time), so a retried upload
 * of the same session maps to the same runs.id and submit_run ignores the duplicate.
 * This is the same identity TabletApp already uses for its upload queue (runKey).
 * Formatted as an RFC 9562 version-8 (custom) UUID. Works without Web Crypto, so plain-HTTP LAN tests upload too.
 */
export function runIdFor(run: Pick<RunResult, 'studyId' | 'participantId' | 'startedAtIso'>): string {
  const hex = hash128(`${run.studyId}|${run.participantId}|${run.startedAtIso}`)
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '8' + hex.slice(13, 16),
    variant + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}
