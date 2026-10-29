import type { BlockInsert, BlockRow, BlockTypeValue, StudyInsert, StudyRow } from './database.types';

export type BlockType = BlockTypeValue;

/**
 * UI-level choice. It is not a column: it maps onto `studies.randomized`
 * plus `blocks.random_group` (see `toStudyRows`).
 * - off:    randomized = false
 * - all:    randomized = true, every block in group ALL_BLOCKS_GROUP
 * - groups: randomized = true, researcher-chosen groups; ungrouped blocks keep their position
 */
export type RandomizationMode = 'off' | 'all' | 'groups';
export const ALL_BLOCKS_GROUP = 'all';

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
}

export type ButtonSide = 'left' | 'right';
export const buttonKeys = {
  left: { text: 'left_button_text', icon: 'left_button_icon' },
  right: { text: 'right_button_text', icon: 'right_button_icon' },
} as const;

export interface SurveyOption {
  /** Local React key only; blocks.options stores the labels as text[]. */
  id: string;
  label: string;
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
    | { type: 'instruction'; body: string }
    | { type: 'video'; media: Media | null }
    | { type: 'survey'; prompt: string; options: SurveyOption[] }
  );

export interface StudyDraft {
  name: string;
  settings: StudySettings;
  blocks: DraftBlock[];
}

export type ValidationErrors = Record<string, string>;

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
    },
    blocks: [],
  };
}

export function createId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // getRandomValues also works in HTTP LAN previews and the Jest DOM environment.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

/** instruction1, video2, survey1 … — unique among the existing labels. */
export function defaultLabel(type: BlockType, blocks: DraftBlock[]): string {
  const used = new Set(blocks.map((block) => block.label));
  let n = blocks.filter((block) => block.type === type).length + 1;
  while (used.has(type + n)) n += 1;
  return type + n;
}

/** True while a video block still carries its generated label, so a chosen file name may replace it. */
export function isGeneratedLabel(label: string, type: BlockType): boolean {
  return !label.trim() || new RegExp('^' + type + '\\d+$').test(label);
}

export function createBlock(type: BlockType, existing: DraftBlock[] = []): DraftBlock {
  const base = { id: createId(), label: defaultLabel(type, existing), random_group: '' };
  if (type === 'instruction') return { ...base, type, body: '' };
  if (type === 'video') return { ...base, type, media: null };
  return {
    ...base,
    type,
    prompt: '',
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'].map((label) => ({
      id: createId(),
      label,
    })),
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

export function validateStudy(draft: StudyDraft): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!draft.name.trim()) errors.name = 'Give your study a name.';
  if (!draft.blocks.length) errors.blocks = 'Add at least one block to your study.';
  for (const side of ['left', 'right'] as const) {
    const icon = draft.settings[buttonKeys[side].icon];
    if (icon?.kind === 'local' && icon.status !== 'ready') {
      errors[side + '.icon'] =
        icon.status === 'error' ? 'Replace or remove this unreadable image.' : 'Wait for the image preview to load.';
    }
  }
  if (draft.settings.randomization === 'groups') {
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
    if (block.type === 'instruction' && !block.body.trim()) {
      errors[block.id + '.body'] = 'Add the instructions participants will see.';
    }
    if (block.type === 'video') {
      if (!block.media) errors[block.id + '.media'] = 'Choose a video for this block.';
      else if (block.media.kind === 'local' && block.media.status !== 'ready')
        errors[block.id + '.media'] =
          block.media.status === 'error'
            ? 'This video cannot be played. Choose another file.'
            : 'Wait for the video preview to load.';
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

function groupFor(draft: StudyDraft, block: DraftBlock): string | null {
  if (draft.settings.randomization === 'all') return ALL_BLOCKS_GROUP;
  return block.random_group.trim() || null;
}

/**
 * Maps the editor state onto public.studies / public.blocks rows.
 * `uploadedPaths` maps LocalMedia.id → Storage object path and must cover every local file
 * (stored files keep their existing path);
 * blob URLs and File objects never cross this boundary.
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
  const study: StudyInsert = {
    id: studyId,
    name: draft.name.trim(),
    randomized: s.randomization !== 'off',
    show_video_bar: s.show_video_bar,
    show_response_buttons: s.show_response_buttons,
    left_button_text: s.left_button_text.trim(),
    right_button_text: s.right_button_text.trim(),
    left_button_icon_path: s.left_button_icon ? pathOf(s.left_button_icon) : null,
    right_button_icon_path: s.right_button_icon ? pathOf(s.right_button_icon) : null,
    allow_swipe_back: s.allow_swipe_back,
    allow_pausing: s.allow_pausing,
  };
  const blocks = draft.blocks.map((block, index): BlockInsert => {
    const row: BlockInsert = {
      id: block.id,
      study_id: studyId,
      position: index + 1,
      type: block.type,
      label: block.label.trim(),
      random_group: groupFor(draft, block),
      body: null,
      video_path: null,
      file_name: null,
      prompt: null,
      options: null,
    };
    if (block.type === 'instruction') row.body = block.body.trim();
    if (block.type === 'video') {
      row.video_path = pathOf(block.media!);
      row.file_name = mediaName(block.media!);
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
  const randomization: RandomizationMode = !study.randomized
    ? 'off'
    : ordered.length > 0 && ordered.every((block) => block.random_group === ALL_BLOCKS_GROUP)
      ? 'all'
      : 'groups';
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
    },
    blocks: ordered.map((row): DraftBlock => {
      const base = {
        id: row.id,
        label: row.label,
        random_group: randomization === 'all' ? '' : (row.random_group ?? ''),
      };
      if (row.type === 'instruction') return { ...base, type: 'instruction', body: row.body ?? '' };
      if (row.type === 'video') return { ...base, type: 'video', media: stored(row.video_path, row.file_name) };
      return {
        ...base,
        type: 'survey',
        prompt: row.prompt ?? '',
        options: (row.options ?? []).map((label) => ({ id: createId(), label })),
      };
    }),
  };
}
