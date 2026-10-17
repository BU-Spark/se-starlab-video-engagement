import {
  buildStudyPayload,
  createBlock,
  createStudy,
  moveBlock,
  validateStudy,
  type StudyDraft,
  type LocalMedia,
} from './study-model';

function validStudy(): StudyDraft {
  return {
    ...createStudy(),
    name: 'Attention study',
    blocks: [{ id: 'instruction-1', type: 'instruction', text: 'Watch the videos.' }],
  };
}

describe('Researcher study model', () => {
  it('starts empty with agreed defaults and independent state', () => {
    const draft = createStudy();
    expect(draft.blocks).toEqual([]);
    expect(draft.settings.randomization.mode).toBe('none');
    expect(draft.settings.response_buttons.left.default_icon).toBe('thumbs_down');
    expect(draft.settings.response_buttons.right.default_icon).toBe('thumbs_up');
    draft.settings.response_buttons.left.label = 'Changed';
    expect(createStudy().settings.response_buttons.left.label).toBe('');
  });
  it('gives blocks and options unique IDs', () => {
    expect(createBlock('instruction').id).not.toBe(createBlock('instruction').id);
    const survey = createBlock('survey');
    if (survey.type !== 'survey') throw new Error('Wrong block type');
    expect(survey.options).toHaveLength(5);
    expect(new Set(survey.options.map((o) => o.id)).size).toBe(5);
  });
  it('reorders without mutating source or changing identity and content', () => {
    const blocks = [createBlock('instruction'), createBlock('survey'), createBlock('video')];
    const moved = moveBlock(blocks, blocks[1].id, -1);
    expect(moved).toEqual([blocks[1], blocks[0], blocks[2]]);
    expect(blocks[0].type).toBe('instruction');
    expect(moved[0]).toBe(blocks[1]);
  });
  it('ignores invalid moves', () => {
    const blocks = [createBlock('instruction'), createBlock('survey')];
    expect(moveBlock(blocks, blocks[0].id, -1)).toBe(blocks);
    expect(moveBlock(blocks, blocks[1].id, 1)).toBe(blocks);
    expect(moveBlock(blocks, 'missing', 1)).toBe(blocks);
  });
  it('validates name and empty block list', () => {
    expect(validateStudy(createStudy())).toEqual({ name: expect.any(String), blocks: expect.any(String) });
    expect(validateStudy({ ...validStudy(), name: '  ' }).name).toBeDefined();
  });
  it('checks required fields on every block type', () => {
    const draft = validStudy();
    draft.blocks = [
      { id: 'i', type: 'instruction', text: ' ' },
      { id: 'v', type: 'video', media: null },
      { id: 's', type: 'survey', question: '', options: [{ id: 'o', label: '' }] },
    ];
    expect(Object.keys(validateStudy(draft))).toEqual(['i.text', 'v.media', 's.question', 's.options', 'o.label']);
  });
  it('rejects loading and unreadable video', () => {
    const draft = validStudy();
    const media: LocalMedia = {
      id: 'm',
      file: new File(['video'], 'a.mp4', { type: 'video/mp4' }),
      url: 'blob:local',
      status: 'loading',
    };
    draft.blocks.push({ id: 'v', type: 'video', media });
    expect(validateStudy(draft)['v.media']).toMatch(/Wait/);
    media.status = 'error';
    expect(validateStudy(draft)['v.media']).toMatch(/cannot be played/);
    media.status = 'ready';
    expect(validateStudy(draft)).toEqual({});
  });
  it('rejects invalid drafts at the API boundary', () => {
    expect(() => buildStudyPayload(createStudy(), {})).toThrow('not ready');
  });
  it('requires confirmed assets and excludes local files and URLs', () => {
    const draft = validStudy();
    const media: LocalMedia = {
      id: 'media-1',
      file: new File(['video'], 'private.mp4', { type: 'video/mp4' }),
      url: 'blob:private',
      status: 'ready',
    };
    draft.blocks.push({ id: 'v', type: 'video', media });
    expect(() => buildStudyPayload(draft, {})).toThrow('Upload and confirm');
    const payload = buildStudyPayload(draft, { 'media-1': 'server-asset-1' });
    expect(payload.blocks[1]).toEqual({ id: 'v', type: 'video', asset_id: 'server-asset-1' });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('blob:');
    expect(serialized).not.toContain('private.mp4');
    expect(serialized).not.toContain('"file"');
  });
  it('preserves option order and maps custom icons', () => {
    const draft = validStudy();
    draft.settings.response_buttons.left.icon = {
      id: 'icon-1',
      file: new File(['x'], 'icon.png'),
      url: 'blob:icon',
      status: 'ready',
    };
    draft.blocks.push({
      id: 's',
      type: 'survey',
      question: ' Enjoyed? ',
      options: [
        { id: 'a', label: ' Yes ' },
        { id: 'b', label: 'No' },
      ],
    });
    const payload = buildStudyPayload(draft, { 'icon-1': 'asset-icon-1' });
    expect(payload.settings.response_buttons.left).toEqual({
      label: '',
      default_icon: 'thumbs_down',
      icon_asset_id: 'asset-icon-1',
    });
    expect(payload.blocks[1]).toEqual({
      id: 's',
      type: 'survey',
      question: 'Enjoyed?',
      options: [
        { id: 'a', label: 'Yes' },
        { id: 'b', label: 'No' },
      ],
    });
  });
});
