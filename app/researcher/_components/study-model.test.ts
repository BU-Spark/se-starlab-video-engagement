import {
  copyName,
  copyStudyRows,
  createBlock,
  createStudy,
  fromStudyRows,
  importBlocks,
  importIcon,
  insertBlocks,
  plannedCopies,
  moveBlockTo,
  duplicateBlock,
  plannedUploads,
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
    // Tap to pause is on by default for new studies.
    allow_pausing: true,
    audio_record: false,
    camera_record: true,
  });
});

test('new studies have tap to pause on, and no comment, share or save settings', () => {
  const { settings } = createStudy();
  expect(settings.allow_pausing).toBe(true);
  expect(Object.keys(settings).filter((key) => /comment|share|save/.test(key))).toEqual([]);
});

test('maps blocks onto public.blocks with 1-based positions and type-specific columns', () => {
  const draft = readyDraft();
  const video = draft.blocks[1];
  if (video.type === 'video') {
    video.title = ' My cat ';
    video.description = 'Line one\nLine two';
  }
  const { blocks } = toStudyRows(draft, STUDY_ID, pathsFor(draft));
  expect(blocks.map((b) => [b.position, b.type, b.label])).toEqual([
    [1, 'instructions', 'instruction1'],
    [2, 'video', 'clip one.mp4'],
    [3, 'survey', 'survey1'],
  ]);
  expect(blocks[0]).toMatchObject({ body: 'Watch each video.', prompt: null, title: null });
  expect(blocks[1]).toMatchObject({
    video_path: STUDY_ID + '/videos/media-clip one.mp4-clip_one.mp4',
    file_name: 'clip one.mp4',
    title: 'My cat',
    description: 'Line one\nLine two',
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

test('labels are required and files must be uploaded before rows are built', () => {
  const draft = readyDraft();
  draft.blocks[0].label = ' ';
  expect(validateStudy(draft)[draft.blocks[0].id + '.label']).toBeDefined();
  draft.blocks[0].label = 'intro';
  expect(() => toStudyRows(draft, STUDY_ID, {})).toThrow('Upload every selected file');
});

test('labels must be unique within a study (blocks.label is unique per study)', () => {
  const draft = readyDraft();
  draft.blocks[2].label = ' clip one.mp4 ';
  const errors = validateStudy(draft);
  expect(errors[draft.blocks[1].id + '.label']).toMatch('must be unique');
  expect(errors[draft.blocks[2].id + '.label']).toMatch('must be unique');
  draft.blocks[2].label = 'survey1';
  expect(validateStudy(draft)[draft.blocks[2].id + '.label']).toBeUndefined();
});

test('fromStudyRows restores what toStudyRows saved', () => {
  const draft = readyDraft();
  draft.settings.randomization = 'groups';
  draft.blocks[1].random_group = 'A';
  draft.blocks[2].random_group = 'A';
  draft.settings.left_button_icon = media('no.png', 'image/png');
  draft.settings.allow_swipe_back = true;
  const video = draft.blocks[1];
  if (video.type === 'video') video.title = 'Title';
  const { rows, restored } = roundTrip(draft, { [plannedUploads(draft, STUDY_ID)[0].path]: 'https://signed/icon' });
  expect(restored.name).toBe('Attention study');
  expect(restored.settings.randomization).toBe('groups');
  expect(restored.settings.allow_swipe_back).toBe(true);
  expect(restored.settings.left_button_icon).toMatchObject({ kind: 'stored', url: 'https://signed/icon' });
  expect(restored.blocks.map((b) => [b.id, b.type, b.label, b.random_group])).toEqual(
    draft.blocks.map((b) => [b.id, b.type, b.label.trim(), b.random_group.trim()])
  );
  const restoredVideo = restored.blocks[1];
  expect(restoredVideo).toMatchObject({ type: 'video', title: 'Title', description: '' });
  expect(restoredVideo.type === 'video' && restoredVideo.media).toMatchObject({ kind: 'stored', name: 'clip one.mp4' });
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
  expect(restored.settings).toMatchObject({ audio_record: false, camera_record: false });
});

test('copy names skip names already taken', () => {
  expect(copyName('Pilot', [])).toBe('Pilot (copy)');
  expect(copyName('Pilot', ['Pilot (copy)'])).toBe('Pilot (copy 2)');
  expect(copyName('Pilot', ['Pilot (copy)', 'Pilot (copy 2)', 'Pilot (copy 4)'])).toBe('Pilot (copy 3)');
});

test('copyStudyRows gives the copy new ids and its own copies of every file', () => {
  const draft = readyDraft();
  const rows = toStudyRows(draft, STUDY_ID, pathsFor(draft));
  const study = { ...rows.study, created_at: NOW, updated_at: NOW };
  const blocks = rows.blocks.map((block) => ({ ...block, created_at: NOW })).reverse();
  const NEW_ID = '00000000-0000-4000-8000-000000000002';
  const copy = copyStudyRows(study, blocks, NEW_ID, 'Copy');

  expect(copy.study).toEqual({
    ...rows.study,
    id: NEW_ID,
    name: 'Copy',
    left_button_icon_path: rows.study.left_button_icon_path?.replace(STUDY_ID, NEW_ID) ?? null,
    right_button_icon_path: rows.study.right_button_icon_path?.replace(STUDY_ID, NEW_ID) ?? null,
  });
  expect(copy.blocks.map((block) => block.position)).toEqual(rows.blocks.map((block) => block.position));
  copy.blocks.forEach((block, index) => {
    const original = rows.blocks[index];
    expect(block).toEqual({
      ...original,
      id: block.id,
      study_id: NEW_ID,
      video_path: original.video_path?.replace(STUDY_ID, NEW_ID) ?? null,
    });
    expect(block.id).not.toBe(original.id);
  });
  const originalPaths = [
    rows.study.left_button_icon_path,
    rows.study.right_button_icon_path,
    ...rows.blocks.map((block) => block.video_path),
  ].filter(Boolean);
  expect(copy.files.map((file) => file.from).sort()).toEqual([...originalPaths].sort());
  for (const file of copy.files) expect(file.to.startsWith(NEW_ID + '/')).toBe(true);
});

describe('moveBlockTo', () => {
  const blocks = (['instructions', 'video', 'survey', 'instructions'] as const).reduce<DraftBlock[]>(
    (list, type) => [...list, createBlock(type, list)],
    []
  );
  const order = (list: DraftBlock[]) => list.map((block) => blocks.indexOf(block));

  it('moves a block forward or backward to the given position', () => {
    expect(order(moveBlockTo(blocks, blocks[0].id, 2))).toEqual([1, 2, 0, 3]);
    expect(order(moveBlockTo(blocks, blocks[3].id, 0))).toEqual([3, 0, 1, 2]);
  });

  it('clamps the position and ignores unknown ids', () => {
    expect(order(moveBlockTo(blocks, blocks[1].id, 99))).toEqual([0, 2, 3, 1]);
    expect(moveBlockTo(blocks, 'missing', 0)).toBe(blocks);
    expect(moveBlockTo(blocks, blocks[2].id, 2)).toBe(blocks);
  });
});

describe('duplicateBlock', () => {
  it('inserts a copy right after the block with a new id, a unique label and new option ids', () => {
    const survey = { ...createBlock('survey'), label: 'rating', prompt: 'Enjoyed it?' } as DraftBlock;
    const blocks = [createBlock('instructions'), survey, createBlock('video')];
    const first = duplicateBlock(blocks, survey.id, (media) => media);
    expect(first.blocks.map((block) => block.label)).toEqual(['instruction1', 'rating', 'rating (copy)', 'video1']);
    const copy = first.blocks[2];
    expect(copy.id).not.toBe(survey.id);
    expect(copy.type === 'survey' && copy.prompt).toBe('Enjoyed it?');
    if (copy.type === 'survey' && survey.type === 'survey') {
      expect(copy.options.map((o) => o.label)).toEqual(survey.options.map((o) => o.label));
      expect(copy.options.some((o, i) => o.id === survey.options[i].id)).toBe(false);
    }
    // Copying again picks the next free label.
    expect(duplicateBlock(first.blocks, survey.id, (media) => media).copy?.label).toBe('rating (copy 2)');
  });

  it('gives a video copy its own media entry', () => {
    const video = createBlock('video');
    const media = {
      kind: 'stored',
      id: 'm1',
      path: 's/videos/a.mp4',
      name: 'a.mp4',
      url: null,
      status: 'ready',
    } as const;
    const withMedia = { ...video, media } as DraftBlock;
    const { copy } = duplicateBlock([withMedia], video.id, (m) => ({ ...m, id: 'm2' }));
    expect(copy?.type === 'video' && copy.media).toEqual({ ...media, id: 'm2' });
  });
});

describe('library import', () => {
  const OTHER_ID = '00000000-0000-4000-8000-0000000000ff';
  // Rows as another study saved them.
  function otherStudyRows() {
    const draft = readyDraft();
    draft.settings.right_button_icon = media('yes.png', 'image/png');
    const paths = Object.fromEntries(plannedUploads(draft, OTHER_ID).map((u) => [u.media.id, u.path]));
    return toStudyRows(draft, OTHER_ID, paths);
  }

  it('turns blocks from another study into new blocks with unique labels and no random group', () => {
    const { blocks: rows } = otherStudyRows();
    const existing = [{ ...createBlock('instructions'), label: 'instruction1' }];
    const imported = importBlocks(
      rows.map((row) => ({ ...row, random_group: 'A', created_at: NOW }) as never),
      existing,
      { [rows[1].video_path!]: 'https://signed/clip' }
    );
    expect(imported.map((block) => block.type)).toEqual(['instructions', 'video', 'survey']);
    expect(imported.map((block) => block.label)).toEqual(['instruction1 (copy)', 'clip one.mp4', 'survey1']);
    expect(imported.every((block, i) => block.id !== rows[i].id && block.random_group === '')).toBe(true);
    expect(imported[1].type === 'video' && imported[1].media).toMatchObject({
      kind: 'stored',
      path: rows[1].video_path,
      url: 'https://signed/clip',
    });
  });

  it('inserts imported blocks at the start, the end or after a block', () => {
    const blocks = [createBlock('instructions'), createBlock('survey')];
    const added = [createBlock('video')];
    expect(insertBlocks(blocks, added, 0)[0]).toBe(added[0]);
    expect(insertBlocks(blocks, added, 1)[1]).toBe(added[0]);
    expect(insertBlocks(blocks, added, 99)[2]).toBe(added[0]);
  });

  it("copies another study's files into this study's folder when saving", () => {
    const { study, blocks: rows } = otherStudyRows();
    const draft = readyDraft();
    draft.blocks = importBlocks(rows as never, [], {});
    draft.settings.right_button_icon = importIcon(study.right_button_icon_path!);
    const copies = plannedCopies(draft, STUDY_ID);
    expect(copies.map((copy) => copy.media.path)).toEqual([study.right_button_icon_path, rows[1].video_path]);
    expect(copies.every((copy) => copy.to.startsWith(STUDY_ID + '/'))).toBe(true);
    // The saved rows point at the copies, not at the other study's files.
    const saved = toStudyRows(draft, STUDY_ID, Object.fromEntries(copies.map((c) => [c.media.id, c.to])));
    expect(saved.study.right_button_icon_path).toBe(copies[0].to);
    expect(saved.blocks[1].video_path).toBe(copies[1].to);
    // Files already in this study's folder are not copied again.
    expect(plannedCopies(draft, OTHER_ID)).toEqual([]);
  });
});
