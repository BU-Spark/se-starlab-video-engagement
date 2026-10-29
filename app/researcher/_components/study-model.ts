import type {
  BlockInsert,
  BlockRow,
  BlockTypeValue,
  CommentJson,
  StudyInsert,
  StudyRow,
} from '@/app/utils/supabase/database.types';

export type BlockType = BlockTypeValue;

/**
 * UI-level choice. It is not a column: it maps onto `studies.randomized` plus `blocks.random_group`
 * following the tablet's rule in app/utils/runner/orderBlocks.ts (see `toStudyRows`).
 * - off:    randomized = false, no groups → fixed order
 * - all:    randomized = true → every block shuffled (groups are ignored, so none are stored)
 * - groups: randomized = false, researcher-chosen groups → shuffled within each group, others fixed
 */
export type RandomizationMode = 'off' | 'all' | 'groups';

/** The tablet's share panel default (StudyDisplaySettings.shareOptions). */
export const DEFAULT_SHARE_OPTIONS = ['Copy link', 'Messages', 'Email', 'Repost', 'More'];

/** A file chosen in this browser session; uploaded to Storage on save. */
export interface LocalMedia {
  kind: 'local';
  id: string;
  file: File;
  url: string;
  status: 'loading' | 'ready' | 'error';
}

/** A file already in Storage (edit mode). `url` is a signed preview URL, or null if signing failed. */
export interface StoredMedia {
  kind: 'stored';
  id: string;
  path: string;
  name: string;
  url: string | null;
  status: 'loading' | 'ready' | 'error';
}

export type Media = LocalMedia | StoredMedia;

export function mediaName(media: Media): string {
  return media.kind === 'local' ? media.file.name : media.name;
}

/** An editable list entry (share options, survey options); the id is a local React key only. */
export interface TextItem {
  id: string;
  label: string;
}

/** Field names follow public.studies so the save mapping stays one-to-one. */
export interface StudySettings {
  randomization: RandomizationMode;
  show_video_bar: boolean;
  show_response_buttons: boolean;
  left_button_text: string;
  right_button_text: string;
  /** Custom icon; null keeps the default thumbs-down icon. */
  left_button_icon: Media | null;
  /** Custom icon; null keeps the default thumbs-up icon. */
  right_button_icon: Media | null;
  allow_swipe_back: boolean;
  allow_pausing: boolean;
  comment_button: boolean;
  save_button: boolean;
  share_button: boolean;
  pause_on_share: boolean;
  share_options: TextItem[];
  audio_record: boolean;
  camera_record: boolean;
}

export type ButtonSide = 'left' | 'right';
export const buttonKeys = {
  left: { text: 'left_button_text', icon: 'left_button_icon' },
  right: { text: 'right_button_text', icon: 'right_button_icon' },
} as const;

export type SurveyOption = TextItem;

/** A researcher-written comment shown in the tablet's comments panel. `likes` is the raw input text. */
export interface DraftComment {
  id: string;
  author: string;
  text: string;
  likes: string;
}

interface BlockBase {
  id: string;
  /** blocks.label — the stimulus name that appears in exported data. */
  label: string;
  /** blocks.random_group — only used when randomization is 'groups'. */
  random_group: string;
}

export type DraftBlock = BlockBase &
  (
    | { type: 'instructions'; body: string }
    | { type: 'video'; media: Media | null; title: string; description: string; comments: DraftComment[] }
    | { type: 'survey'; prompt: string; options: SurveyOption[] }
  );

export interface StudyDraft {
  name: string;
  settings: StudySettings;
  blocks: DraftBlock[];
}

export type ValidationErrors = Record<string, string>;

export function createId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // getRandomValues also works in HTTP LAN previews and the Jest DOM environment.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

export const textItems = (labels: string[]): TextItem[] => labels.map((label) => ({ id: createId(), label }));

export function createStudy(): StudyDraft {
  return {
    name: '',
    settings: {
      randomization: 'off',
      show_video_bar: true,
      show_response_buttons: true,
      left_button_text: '',
      right_button_text: '',
      left_button_icon: null,
      right_button_icon: null,
      allow_swipe_back: false,
      allow_pausing: false,
      comment_button: false,
      save_button: false,
      share_button: false,
      pause_on_share: false,
      share_options: textItems(DEFAULT_SHARE_OPTIONS),
      audio_record: false,
      camera_record: false,
    },
    blocks: [],
  };
}

/** Prefix of generated labels; matches the design document's data example (instruction1, video1, survey1). */
const labelPrefix: Record<BlockType, string> = { instructions: 'instruction', video: 'video', survey: 'survey' };

/** instruction1, video2, survey1 … — unique among the existing labels. */
export function defaultLabel(type: BlockType, blocks: DraftBlock[]): string {
  const used = new Set(blocks.map((block) => block.label));
  let n = blocks.filter((block) => block.type === type).length + 1;
  while (used.has(labelPrefix[type] + n)) n += 1;
  return labelPrefix[type] + n;
}

/** True while a block still carries its generated label, so a chosen file name may replace it. */
export function isGeneratedLabel(label: string, type: BlockType): boolean {
  return !label.trim() || new RegExp('^' + labelPrefix[type] + '\\d+$').test(label);
}

export function createComment(): DraftComment {
  return { id: createId(), author: '', text: '', likes: '' };
}

export function createBlock(type: BlockType, existing: DraftBlock[] = []): DraftBlock {
  const base = { id: createId(), label: defaultLabel(type, existing), random_group: '' };
  if (type === 'instructions') return { ...base, type, body: '' };
  if (type === 'video') return { ...base, type, media: null, title: '', description: '', comments: [] };
  return {
    ...base,
    type,
    prompt: '',
    options: textItems(['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree']),
  };
}

export function moveBlock(blocks: DraftBlock[], id: string, direction: -1 | 1): DraftBlock[] {
  const from = blocks.findIndex((block) => block.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= blocks.length) return blocks;
  const next = [...blocks];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

const LIKES_PATTERN = /^\d{1,9}$/;

export function validateStudy(draft: StudyDraft): ValidationErrors {
  const errors: ValidationErrors = {};
  const s = draft.settings;
  if (!draft.name.trim()) errors.name = 'Give your study a name.';
  if (!draft.blocks.length) errors.blocks = 'Add at least one block to your study.';
  for (const side of ['left', 'right'] as const) {
    const icon = s[buttonKeys[side].icon];
    if (icon?.kind === 'local' && icon.status !== 'ready') {
      errors[side + '.icon'] =
        icon.status === 'error' ? 'Replace or remove this unreadable image.' : 'Wait for the image preview to load.';
    }
  }
  if (s.share_button) {
    if (!s.share_options.length) errors.share_options = 'Add at least one share option.';
    for (const option of s.share_options) {
      if (!option.label.trim()) errors[option.id + '.label'] = 'Option text cannot be empty.';
    }
  }
  if (s.randomization === 'groups') {
    const sizes = new Map<string, number>();
    for (const block of draft.blocks) {
      const group = block.random_group.trim();
      if (group) sizes.set(group, (sizes.get(group) ?? 0) + 1);
    }
    if (![...sizes.values()].some((size) => size >= 2)) {
      errors.randomization = 'Give at least two blocks the same group name, or choose another randomization option.';
    }
  }
  for (const block of draft.blocks) {
    if (!block.label.trim()) errors[block.id + '.label'] = 'Give this block a label for the data export.';
    if (block.type === 'instructions' && !block.body.trim()) {
      errors[block.id + '.body'] = 'Add the instructions participants will see.';
    }
    if (block.type === 'video') {
      if (!block.media) errors[block.id + '.media'] = 'Choose a video for this block.';
      else if (block.media.kind === 'local' && block.media.status !== 'ready')
        errors[block.id + '.media'] =
          block.media.status === 'error'
            ? 'This video cannot be played. Choose another file.'
            : 'Wait for the video preview to load.';
      for (const comment of block.comments) {
        if (!comment.author.trim()) errors[comment.id + '.author'] = 'Enter a name.';
        if (!comment.text.trim()) errors[comment.id + '.text'] = 'Enter the comment text.';
        if (comment.likes.trim() && !LIKES_PATTERN.test(comment.likes.trim())) {
          errors[comment.id + '.likes'] = 'Use a whole number, or leave blank to hide likes.';
        }
      }
    }
    if (block.type === 'survey') {
      if (!block.prompt.trim()) errors[block.id + '.prompt'] = 'Enter a survey question.';
      if (block.options.length < 2) errors[block.id + '.options'] = 'Include at least two response options.';
      for (const option of block.options) {
        if (!option.label.trim()) errors[option.id + '.label'] = 'Option text cannot be empty.';
      }
    }
  }
  return errors;
}

/** Keeps storage keys ASCII-safe; the original name is still saved in blocks.file_name. */
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._]+/, '');
  return (cleaned || 'file').slice(-100);
}

export interface PendingUpload {
  media: LocalMedia;
  path: string;
}

/** Every local file that must reach Storage before the rows are inserted, with its object path. */
export function plannedUploads(draft: StudyDraft, studyId: string): PendingUpload[] {
  const uploads: PendingUpload[] = [];
  for (const side of ['left', 'right'] as const) {
    const icon = draft.settings[buttonKeys[side].icon];
    if (icon?.kind === 'local') {
      uploads.push({
        media: icon,
        path: studyId + '/icons/' + side + '-' + icon.id + '-' + safeFileName(icon.file.name),
      });
    }
  }
  for (const block of draft.blocks) {
    if (block.type === 'video' && block.media?.kind === 'local') {
      // The media ID keeps paths unique when a block's video is replaced by a file with the same name.
      uploads.push({
        media: block.media,
        path: studyId + '/videos/' + block.media.id + '-' + safeFileName(block.media.file.name),
      });
    }
  }
  return uploads;
}

const blankToNull = (value: string) => value.trim() || null;

function commentsToJson(comments: DraftComment[]): CommentJson[] | null {
  if (!comments.length) return null;
  return comments.map((comment) => {
    const json: CommentJson = { author: comment.author.trim(), text: comment.text.trim() };
    if (comment.likes.trim()) json.likes = Number(comment.likes.trim());
    return json;
  });
}

/**
 * Maps the editor state onto public.studies / public.blocks rows.
 * `uploadedPaths` maps LocalMedia.id → Storage object path and must cover every local file
 * (stored files keep their existing path); blob URLs and File objects never cross this boundary.
 */
export function toStudyRows(
  draft: StudyDraft,
  studyId: string,
  uploadedPaths: Record<string, string>
): { study: StudyInsert; blocks: BlockInsert[] } {
  if (Object.keys(validateStudy(draft)).length) throw new Error('Study is not ready to save.');
  const pathOf = (media: Media) => {
    if (media.kind === 'stored') return media.path;
    const path = uploadedPaths[media.id];
    if (!path) throw new Error('Upload every selected file before saving.');
    return path;
  };
  const s = draft.settings;
  // Kept even while the share button is off, so switching it back on restores the list.
  const shareOptions = s.share_options.map((option) => option.label.trim()).filter(Boolean);
  const study: StudyInsert = {
    id: studyId,
    name: draft.name.trim(),
    randomized: s.randomization === 'all',
    show_video_bar: s.show_video_bar,
    show_response_buttons: s.show_response_buttons,
    left_button_text: s.left_button_text.trim(),
    right_button_text: s.right_button_text.trim(),
    left_button_icon_path: s.left_button_icon ? pathOf(s.left_button_icon) : null,
    right_button_icon_path: s.right_button_icon ? pathOf(s.right_button_icon) : null,
    allow_swipe_back: s.allow_swipe_back,
    allow_pausing: s.allow_pausing,
    comment_button: s.comment_button,
    save_button: s.save_button,
    share_button: s.share_button,
    pause_on_share: s.pause_on_share,
    share_options: shareOptions.length ? shareOptions : null,
    audio_record: s.audio_record,
    camera_record: s.camera_record,
  };
  const blocks = draft.blocks.map((block, index): BlockInsert => {
    const row: BlockInsert = {
      id: block.id,
      study_id: studyId,
      position: index + 1,
      type: block.type,
      label: block.label.trim(),
      // The tablet applies groups only when the study is not fully randomized.
      random_group: s.randomization === 'groups' ? blankToNull(block.random_group) : null,
      body: null,
      video_path: null,
      file_name: null,
      title: null,
      description: null,
      comments: null,
      prompt: null,
      options: null,
    };
    if (block.type === 'instructions') row.body = block.body.trim();
    if (block.type === 'video') {
      row.video_path = pathOf(block.media!);
      row.file_name = mediaName(block.media!);
      row.title = blankToNull(block.title);
      row.description = blankToNull(block.description);
      row.comments = commentsToJson(block.comments);
    }
    if (block.type === 'survey') {
      row.prompt = block.prompt.trim();
      row.options = block.options.map((option) => option.label.trim());
    }
    return row;
  });
  return { study, blocks };
}

/** Every Storage path a saved study references (icons and videos). */
export function referencedPaths(
  study: Pick<StudyRow, 'left_button_icon_path' | 'right_button_icon_path'>,
  blocks: Pick<BlockRow, 'video_path'>[]
): string[] {
  return [study.left_button_icon_path, study.right_button_icon_path, ...blocks.map((block) => block.video_path)].filter(
    (path): path is string => !!path
  );
}

/**
 * Inverse of `toStudyRows`: rebuilds editor state from saved rows (edit mode).
 * `signedUrls` maps Storage path → preview URL; missing entries leave the preview empty.
 */
export function fromStudyRows(
  study: StudyRow,
  blocks: BlockRow[],
  signedUrls: Record<string, string> = {}
): StudyDraft {
  const stored = (path: string | null, name?: string | null): StoredMedia | null =>
    path
      ? {
          kind: 'stored',
          id: createId(),
          path,
          name: name || path.split('/').pop() || path,
          url: signedUrls[path] ?? null,
          status: 'ready',
        }
      : null;
  const ordered = [...blocks].sort((a, b) => a.position - b.position);
  const randomization: RandomizationMode = study.randomized
    ? 'all'
    : ordered.some((block) => block.random_group)
      ? 'groups'
      : 'off';
  return {
    name: study.name,
    settings: {
      randomization,
      show_video_bar: study.show_video_bar,
      show_response_buttons: study.show_response_buttons,
      left_button_text: study.left_button_text ?? '',
      right_button_text: study.right_button_text ?? '',
      left_button_icon: stored(study.left_button_icon_path),
      right_button_icon: stored(study.right_button_icon_path),
      allow_swipe_back: study.allow_swipe_back,
      allow_pausing: study.allow_pausing,
      comment_button: study.comment_button ?? false,
      save_button: study.save_button ?? false,
      share_button: study.share_button ?? false,
      pause_on_share: study.pause_on_share ?? false,
      share_options: textItems(study.share_options?.length ? study.share_options : DEFAULT_SHARE_OPTIONS),
      audio_record: study.audio_record ?? false,
      camera_record: study.camera_record ?? false,
    },
    blocks: ordered.map((row): DraftBlock => {
      const base = { id: row.id, label: row.label, random_group: row.random_group ?? '' };
      if (row.type === 'video') {
        return {
          ...base,
          type: 'video',
          media: stored(row.video_path, row.file_name),
          title: row.title ?? '',
          description: row.description ?? '',
          comments: (row.comments ?? []).map((comment) => ({
            id: createId(),
            author: comment.author ?? '',
            text: comment.text ?? '',
            likes: typeof comment.likes === 'number' ? String(comment.likes) : '',
          })),
        };
      }
      if (row.type === 'survey') {
        return { ...base, type: 'survey', prompt: row.prompt ?? '', options: textItems(row.options ?? []) };
      }
      // 'instructions' (also covers the legacy 'instruction' value written before the migration).
      return { ...base, type: 'instructions', body: row.body ?? '' };
    }),
  };
}
