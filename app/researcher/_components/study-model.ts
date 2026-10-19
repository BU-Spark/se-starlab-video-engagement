export type BlockType = 'instruction' | 'video' | 'survey';
export type RandomizationMode = 'none' | 'all' | 'videos_only';

export interface LocalMedia {
  id: string;
  file: File;
  url: string;
  status: 'loading' | 'ready' | 'error';
}

export interface ResponseButton {
  label: string;
  default_icon: 'thumbs_down' | 'thumbs_up';
  icon: LocalMedia | null;
}

export interface StudySettings {
  randomization: { mode: RandomizationMode };
  show_video_progress: boolean;
  allow_back_navigation: boolean;
  allow_pause: boolean;
  response_buttons: {
    enabled: boolean;
    left: ResponseButton;
    right: ResponseButton;
  };
}

export interface SurveyOption {
  id: string;
  label: string;
}

export type DraftBlock =
  | { id: string; type: 'instruction'; text: string }
  | { id: string; type: 'video'; media: LocalMedia | null }
  | { id: string; type: 'survey'; question: string; options: SurveyOption[] };

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
      randomization: { mode: 'none' },
      show_video_progress: true,
      allow_back_navigation: false,
      allow_pause: false,
      response_buttons: {
        enabled: true,
        left: { label: '', default_icon: 'thumbs_down', icon: null },
        right: { label: '', default_icon: 'thumbs_up', icon: null },
      },
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

export function createBlock(type: BlockType): DraftBlock {
  const id = createId();
  if (type === 'instruction') return { id, type, text: '' };
  if (type === 'video') return { id, type, media: null };
  return {
    id,
    type,
    question: '',
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
    const icon = draft.settings.response_buttons[side].icon;
    if (icon && icon.status !== 'ready') {
      errors[side + '.icon'] =
        icon.status === 'error' ? 'Replace or remove this unreadable image.' : 'Wait for the image preview to load.';
    }
  }
  for (const block of draft.blocks) {
    if (block.type === 'instruction' && !block.text.trim()) {
      errors[block.id + '.text'] = 'Add the instructions participants will see.';
    }
    if (block.type === 'video') {
      if (!block.media) errors[block.id + '.media'] = 'Choose a video for this block.';
      else if (block.media.status !== 'ready')
        errors[block.id + '.media'] =
          block.media.status === 'error'
            ? 'This video cannot be played. Choose another file.'
            : 'Wait for the video preview to load.';
    }
    if (block.type === 'survey') {
      if (!block.question.trim()) errors[block.id + '.question'] = 'Enter a survey question.';
      if (block.options.length < 2) errors[block.id + '.options'] = 'Include at least two response options.';
      for (const option of block.options) {
        if (!option.label.trim()) errors[option.id + '.label'] = 'Option text cannot be empty.';
      }
    }
  }
  return errors;
}

export interface ApiResponseButton {
  label: string;
  default_icon: ResponseButton['default_icon'];
  icon_asset_id: string | null;
}

export interface StudyPayload {
  name: string;
  settings: Omit<StudySettings, 'response_buttons'> & {
    response_buttons: { enabled: boolean; left: ApiResponseButton; right: ApiResponseButton };
  };
  blocks: (
    | { id: string; type: 'instruction'; text: string }
    | { id: string; type: 'video'; asset_id: string }
    | { id: string; type: 'survey'; question: string; options: SurveyOption[] }
  )[];
}

/** Future API boundary: only confirmed backend asset IDs may cross it. */
export function buildStudyPayload(draft: StudyDraft, uploadedAssets: Record<string, string>): StudyPayload {
  if (Object.keys(validateStudy(draft)).length) throw new Error('Study is not ready to save.');
  function assetId(media: LocalMedia): string {
    const id = uploadedAssets[media.id];
    if (!id) throw new Error('Upload and confirm every selected file before saving.');
    return id;
  }
  function button(value: ResponseButton): ApiResponseButton {
    return {
      label: value.label.trim(),
      default_icon: value.default_icon,
      icon_asset_id: value.icon ? assetId(value.icon) : null,
    };
  }
  return {
    name: draft.name.trim(),
    settings: {
      ...draft.settings,
      response_buttons: {
        enabled: draft.settings.response_buttons.enabled,
        left: button(draft.settings.response_buttons.left),
        right: button(draft.settings.response_buttons.right),
      },
    },
    blocks: draft.blocks.map((block) => {
      if (block.type === 'instruction') return { id: block.id, type: block.type, text: block.text.trim() };
      if (block.type === 'video') return { id: block.id, type: block.type, asset_id: assetId(block.media!) };
      return {
        id: block.id,
        type: block.type,
        question: block.question.trim(),
        options: block.options.map((o) => ({ ...o, label: o.label.trim() })),
      };
    }),
  };
}
