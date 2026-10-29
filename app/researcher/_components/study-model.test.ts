import {
  createBlock,
  createComment,
  createStudy,
  DEFAULT_SHARE_OPTIONS,
  fromStudyRows,
  plannedUploads,
  textItems,
  toStudyRows,
  validateStudy,
  type DraftBlock,
  type LocalMedia,
  type StudyDraft,
} from './study-model';

const STUDY_ID = '00000000-0000-4000-8000-000000000001';
const NOW = '2026-10-29T00:00:00+00:00';

function media(name: string, type: string): LocalMedia {
  return {
    kind: 'local',
    id: 'media-' + name,
    file: new File(['x'], name, { type }),
    url: 'blob:' + name,
    status: 'ready',
  };
}

function readyDraft(): StudyDraft {
  const draft = createStudy();
  draft.name = '  Attention study  ';
  const instructions = createBlock('instructions');
  const video = createBlock('video', [instructions]);
  const survey = createBlock('survey', [instructions, video]);
  if (instructions.type === 'instructions') instructions.body = ' Watch each video. ';
  if (video.type === 'video') {
    video.media = media('clip one.mp4', 'video/mp4');
    video.label = 'clip one.mp4';
  }
  if (survey.type === 'survey') survey.prompt = 'How engaging?';
  draft.blocks = [instructions, video, survey];
  return draft;
}

function pathsFor(draft: StudyDraft): Record<string, string> {
  return Object.fromEntries(plannedUploads(draft, STUDY_ID).map((u) => [u.media.id, u.path]));
}

function roundTrip(draft: StudyDraft, urls: Record<string, string> = {}) {
  const rows = toStudyRows(draft, STUDY_ID, pathsFor(draft));
  const restored = fromStudyRows(
    { ...rows.study, created_at: NOW, updated_at: NOW },
    [...rows.blocks].reverse().map((block) => ({ ...block, created_at: NOW })),
    urls
  );
  return { rows, restored };
}

test('default block labels follow the data export naming', () => {
  const blocks: DraftBlock[] = [];
  for (const type of ['instructions', 'video', 'instructions', 'survey'] as const)
    blocks.push(createBlock(type, blocks));
  expect(blocks.map((b) => b.label)).toEqual(['instruction1', 'video1', 'instruction2', 'survey1']);
});

test('maps settings onto public.studies columns', () => {
  const draft = readyDraft();
  draft.settings.left_button_text = ' No ';
  draft.settings.right_button_icon = media('star.png', 'image/png');
  draft.settings.allow_swipe_back = true;
  draft.settings.comment_button = true;
  draft.settings.share_button = true;
  draft.settings.share_options = textItems([' Copy link ', 'Email']);
  draft.settings.camera_record = true;
  const { study } = toStudyRows(draft, STUDY_ID, pathsFor(draft));
  expect(study).toEqual({
    id: STUDY_ID,
    name: 'Attention study',
    randomized: false,
    show_video_bar: true,
    show_response_buttons: true,
    left_button_text: 'No',
    right_button_text: '',
    left_button_icon_path: null,
    right_button_icon_path: STUDY_ID + '/icons/right-media-star.png-star.png',
    allow_swipe_back: true,
    allow_pausing: false,
    comment_button: true,
    save_button: false,
    share_button: true,
    pause_on_share: false,
    share_options: ['Copy link', 'Email'],
    audio_record: false,
    camera_record: true,
  });
});

test('new studies start with the tablet default share options', () => {
  expect(createStudy().settings.share_options.map((o) => o.label)).toEqual(DEFAULT_SHARE_OPTIONS);
});

test('maps blocks onto public.blocks with 1-based positions and type-specific columns', () => {
  const draft = readyDraft();
  const video = draft.blocks[1];
  if (video.type === 'video') {
    video.title = ' My cat ';
    video.description = 'Line one\nLine two';
    video.comments = [
      { id: 'c1', author: ' sam ', text: ' So cute ', likes: '12' },
      { id: 'c2', author: 'alex', text: 'Again!', likes: '' },
    ];
  }
  const { blocks } = toStudyRows(draft, STUDY_ID, pathsFor(draft));
  expect(blocks.map((b) => [b.position, b.type, b.label])).toEqual([
    [1, 'instructions', 'instruction1'],
    [2, 'video', 'clip one.mp4'],
    [3, 'survey', 'survey1'],
  ]);
  expect(blocks[0]).toMatchObject({ body: 'Watch each video.', prompt: null, title: null, comments: null });
  expect(blocks[1]).toMatchObject({
    video_path: STUDY_ID + '/videos/media-clip one.mp4-clip_one.mp4',
    file_name: 'clip one.mp4',
    title: 'My cat',
    description: 'Line one\nLine two',
    comments: [
      { author: 'sam', text: 'So cute', likes: 12 },
      { author: 'alex', text: 'Again!' },
    ],
    body: null,
  });
  expect(blocks[2]).toMatchObject({
    prompt: 'How engaging?',
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
  });
  expect(blocks.every((b) => b.study_id === STUDY_ID && b.random_group === null)).toBe(true);
});

test('randomization follows the tablet rule: randomized shuffles all, groups only when not randomized', () => {
  const draft = readyDraft();
  draft.blocks[1].random_group = ' A ';
  draft.blocks[2].random_group = 'A';

  let rows = toStudyRows(draft, STUDY_ID, pathsFor(draft));
  expect(rows.study.randomized).toBe(false);
  expect(rows.blocks.map((b) => b.random_group)).toEqual([null, null, null]);

  draft.settings.randomization = 'all';
  rows = toStudyRows(draft, STUDY_ID, pathsFor(draft));
  expect(rows.study.randomized).toBe(true);
  expect(rows.blocks.map((b) => b.random_group)).toEqual([null, null, null]);

  draft.settings.randomization = 'groups';
  rows = toStudyRows(draft, STUDY_ID, pathsFor(draft));
  expect(rows.study.randomized).toBe(false);
  expect(rows.blocks.map((b) => b.random_group)).toEqual([null, 'A', 'A']);
});

test('group randomization needs at least two blocks in one group', () => {
  const draft = readyDraft();
  draft.settings.randomization = 'groups';
  draft.blocks[0].random_group = 'A';
  expect(validateStudy(draft).randomization).toBeDefined();
  draft.blocks[2].random_group = 'A';
  expect(validateStudy(draft).randomization).toBeUndefined();
});

test('validates comments and share options', () => {
  const draft = readyDraft();
  const video = draft.blocks[1];
  const comment = { ...createComment(), likes: 'lots' };
  if (video.type === 'video') video.comments = [comment];
  draft.settings.share_button = true;
  draft.settings.share_options = textItems(['']);
  const errors = validateStudy(draft);
  expect(errors[comment.id + '.author']).toBeDefined();
  expect(errors[comment.id + '.text']).toBeDefined();
  expect(errors[comment.id + '.likes']).toBeDefined();
  expect(errors[draft.settings.share_options[0].id + '.label']).toBeDefined();
  draft.settings.share_button = false;
  expect(errors[draft.settings.share_options[0].id + '.label']).toBeDefined();
  expect(validateStudy(draft)[draft.settings.share_options[0].id + '.label']).toBeUndefined();
});

test('labels are required and files must be uploaded before rows are built', () => {
  const draft = readyDraft();
  draft.blocks[0].label = ' ';
  expect(validateStudy(draft)[draft.blocks[0].id + '.label']).toBeDefined();
  draft.blocks[0].label = 'intro';
  expect(() => toStudyRows(draft, STUDY_ID, {})).toThrow('Upload every selected file');
});

test('fromStudyRows restores what toStudyRows saved', () => {
  const draft = readyDraft();
  draft.settings.randomization = 'groups';
  draft.blocks[1].random_group = 'A';
  draft.blocks[2].random_group = 'A';
  draft.settings.left_button_icon = media('no.png', 'image/png');
  draft.settings.save_button = true;
  draft.settings.share_options = textItems(['Email']);
  const video = draft.blocks[1];
  if (video.type === 'video') {
    video.title = 'Title';
    video.comments = [{ id: 'c1', author: 'sam', text: 'Hi', likes: '3' }];
  }
  const { rows, restored } = roundTrip(draft, { [plannedUploads(draft, STUDY_ID)[0].path]: 'https://signed/icon' });
  expect(restored.name).toBe('Attention study');
  expect(restored.settings.randomization).toBe('groups');
  expect(restored.settings.save_button).toBe(true);
  expect(restored.settings.share_options.map((o) => o.label)).toEqual(['Email']);
  expect(restored.settings.left_button_icon).toMatchObject({ kind: 'stored', url: 'https://signed/icon' });
  expect(restored.blocks.map((b) => [b.id, b.type, b.label, b.random_group])).toEqual(
    draft.blocks.map((b) => [b.id, b.type, b.label.trim(), b.random_group.trim()])
  );
  const restoredVideo = restored.blocks[1];
  expect(restoredVideo).toMatchObject({ type: 'video', title: 'Title', description: '' });
  expect(restoredVideo.type === 'video' && restoredVideo.media).toMatchObject({ kind: 'stored', name: 'clip one.mp4' });
  expect(restoredVideo.type === 'video' && restoredVideo.comments).toMatchObject([
    { author: 'sam', text: 'Hi', likes: '3' },
  ]);
  // Saving again without changes keeps the stored paths and needs no uploads.
  expect(plannedUploads(restored, STUDY_ID)).toEqual([]);
  expect(toStudyRows(restored, STUDY_ID, {})).toEqual(rows);
});

test('all-blocks randomization round-trips', () => {
  const draft = readyDraft();
  draft.settings.randomization = 'all';
  expect(roundTrip(draft).restored.settings.randomization).toBe('all');
  draft.settings.randomization = 'off';
  expect(roundTrip(draft).restored.settings.randomization).toBe('off');
});

test('rows saved before the migration still load (legacy "instruction" type, missing new columns)', () => {
  const restored = fromStudyRows(
    {
      id: STUDY_ID,
      name: 'Old',
      randomized: false,
      show_video_bar: true,
      show_response_buttons: true,
      left_button_text: '',
      right_button_text: '',
      left_button_icon_path: null,
      right_button_icon_path: null,
      allow_swipe_back: false,
      allow_pausing: false,
      created_at: NOW,
      updated_at: NOW,
    } as unknown as Parameters<typeof fromStudyRows>[0],
    [
      {
        id: 'b1',
        study_id: STUDY_ID,
        position: 1,
        type: 'instruction',
        label: 'instruction1',
        random_group: null,
        body: 'Hi',
        video_path: null,
        file_name: null,
        prompt: null,
        options: null,
        created_at: NOW,
      } as unknown as Parameters<typeof fromStudyRows>[1][number],
    ]
  );
  expect(restored.blocks[0]).toMatchObject({ type: 'instructions', body: 'Hi' });
  expect(restored.settings).toMatchObject({ comment_button: false, share_button: false, audio_record: false });
  expect(restored.settings.share_options.map((o) => o.label)).toEqual(DEFAULT_SHARE_OPTIONS);
});
