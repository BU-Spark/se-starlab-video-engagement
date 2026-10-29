import {
  ALL_BLOCKS_GROUP,
  createBlock,
  createStudy,
  fromStudyRows,
  plannedUploads,
  toStudyRows,
  validateStudy,
  type DraftBlock,
  type LocalMedia,
  type StudyDraft,
} from './study-model';

const STUDY_ID = '00000000-0000-4000-8000-000000000001';

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
  const instruction = createBlock('instruction');
  const video = createBlock('video', [instruction]);
  const survey = createBlock('survey', [instruction, video]);
  if (instruction.type === 'instruction') instruction.body = ' Watch each video. ';
  if (video.type === 'video') {
    video.media = media('clip one.mp4', 'video/mp4');
    video.label = 'clip one.mp4';
  }
  if (survey.type === 'survey') survey.prompt = 'How engaging?';
  draft.blocks = [instruction, video, survey];
  return draft;
}

function pathsFor(draft: StudyDraft): Record<string, string> {
  return Object.fromEntries(plannedUploads(draft, STUDY_ID).map((u) => [u.media.id, u.path]));
}

test('default block labels follow the data export naming', () => {
  const blocks: DraftBlock[] = [];
  for (const type of ['instruction', 'video', 'instruction', 'survey'] as const) blocks.push(createBlock(type, blocks));
  expect(blocks.map((b) => b.label)).toEqual(['instruction1', 'video1', 'instruction2', 'survey1']);
});

test('maps settings onto public.studies columns', () => {
  const draft = readyDraft();
  draft.settings.left_button_text = ' No ';
  draft.settings.right_button_icon = media('star.png', 'image/png');
  draft.settings.allow_swipe_back = true;
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
  });
});

test('maps blocks onto public.blocks with 1-based positions and type-specific columns', () => {
  const draft = readyDraft();
  const { blocks } = toStudyRows(draft, STUDY_ID, pathsFor(draft));
  expect(blocks.map((b) => [b.position, b.type, b.label])).toEqual([
    [1, 'instruction', 'instruction1'],
    [2, 'video', 'clip one.mp4'],
    [3, 'survey', 'survey1'],
  ]);
  expect(blocks[0]).toMatchObject({ body: 'Watch each video.', prompt: null, options: null, video_path: null });
  expect(blocks[1]).toMatchObject({
    video_path: STUDY_ID + '/videos/media-clip one.mp4-clip_one.mp4',
    file_name: 'clip one.mp4',
    body: null,
  });
  expect(blocks[2]).toMatchObject({
    prompt: 'How engaging?',
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
  });
  expect(blocks.every((b) => b.study_id === STUDY_ID && b.random_group === null)).toBe(true);
});

test('randomization modes map to studies.randomized and blocks.random_group', () => {
  const draft = readyDraft();
  draft.blocks[1].random_group = ' A ';
  draft.blocks[2].random_group = 'A';

  let rows = toStudyRows(draft, STUDY_ID, pathsFor(draft));
  expect(rows.study.randomized).toBe(false);

  draft.settings.randomization = 'all';
  rows = toStudyRows(draft, STUDY_ID, pathsFor(draft));
  expect(rows.study.randomized).toBe(true);
  expect(rows.blocks.map((b) => b.random_group)).toEqual([ALL_BLOCKS_GROUP, ALL_BLOCKS_GROUP, ALL_BLOCKS_GROUP]);

  draft.settings.randomization = 'groups';
  rows = toStudyRows(draft, STUDY_ID, pathsFor(draft));
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
  const rows = toStudyRows(draft, STUDY_ID, pathsFor(draft));
  const now = '2026-10-28T00:00:00+00:00';
  const restored = fromStudyRows(
    { ...rows.study, created_at: now, updated_at: now },
    [...rows.blocks].reverse().map((block) => ({ ...block, created_at: now })),
    { [rows.study.left_button_icon_path!]: 'https://signed/icon' }
  );
  expect(restored.name).toBe('Attention study');
  expect(restored.settings.randomization).toBe('groups');
  expect(restored.settings.left_button_icon).toMatchObject({ kind: 'stored', url: 'https://signed/icon' });
  expect(restored.blocks.map((b) => [b.id, b.label, b.random_group])).toEqual(
    draft.blocks.map((b) => [b.id, b.label.trim(), b.random_group.trim()])
  );
  const video = restored.blocks[1];
  expect(video.type === 'video' && video.media).toMatchObject({ kind: 'stored', name: 'clip one.mp4', url: null });
  // Saving again without changes keeps the stored paths and needs no uploads.
  expect(plannedUploads(restored, STUDY_ID)).toEqual([]);
  expect(toStudyRows(restored, STUDY_ID, {}).blocks[1].video_path).toBe(rows.blocks[1].video_path);
});

test('all-blocks randomization round-trips without leaking the reserved group name', () => {
  const draft = readyDraft();
  draft.settings.randomization = 'all';
  const rows = toStudyRows(draft, STUDY_ID, pathsFor(draft));
  const now = '2026-10-28T00:00:00+00:00';
  const restored = fromStudyRows(
    { ...rows.study, created_at: now, updated_at: now },
    rows.blocks.map((b) => ({ ...b, created_at: now }))
  );
  expect(restored.settings.randomization).toBe('all');
  expect(restored.blocks.every((b) => b.random_group === '')).toBe(true);
});
