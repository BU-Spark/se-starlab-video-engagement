import type { RunResult } from '@/app/types';
import type { BlockRow, StudyRow } from '@/app/utils/supabase/database.types';
import { orderBlocks } from '@/app/utils/runner';
import { mediaPathsOf, rowsToStudy, runIdFor, toSubmitRunPayload } from '../supabaseMapping';

const NOW = '2026-10-29T00:00:00+00:00';
const S = '00000000-0000-4000-8000-0000000000aa';

const study: StudyRow = {
  id: S,
  name: 'Attention',
  randomized: false,
  show_video_bar: true,
  show_response_buttons: true,
  left_button_text: 'No',
  right_button_text: '',
  left_button_icon_path: null,
  right_button_icon_path: S + '/icons/right.png',
  allow_swipe_back: true,
  allow_pausing: false,
  comment_button: true,
  save_button: true,
  share_button: false,
  pause_on_share: true,
  share_options: ['Email'],
  audio_record: false,
  camera_record: false,
  created_at: NOW,
  updated_at: NOW,
};

const block = (over: Partial<BlockRow>): BlockRow => ({
  id: 'b',
  study_id: S,
  position: 1,
  type: 'instructions',
  label: 'instruction1',
  random_group: null,
  body: null,
  video_path: null,
  file_name: null,
  title: null,
  description: null,
  comments: null,
  prompt: null,
  options: null,
  created_at: NOW,
  ...over,
});

const blocks: BlockRow[] = [
  block({ id: 'b3', position: 3, type: 'survey', label: 'survey1', prompt: 'Fun?', options: ['Yes', 'No'] }),
  block({ id: 'b1', position: 1, body: 'Welcome' }),
  block({
    id: 'b2',
    position: 2,
    type: 'video',
    label: 'cat.mp4',
    random_group: 'A',
    video_path: S + '/videos/x-cat.mp4',
    file_name: 'cat.mp4',
    title: 'My cat',
    comments: [
      { author: 'sam', text: 'cute', likes: 4 },
      { author: 'alex', text: 'again' },
    ],
  }),
];

const urls = { [S + '/icons/right.png']: 'https://cdn/right?sig', [S + '/videos/x-cat.mp4']: 'https://cdn/cat?sig' };

describe('rowsToStudy', () => {
  it('builds the tablet Study from Supabase rows', () => {
    expect(rowsToStudy(study, blocks, urls)).toEqual({
      id: S,
      name: 'Attention',
      randomized: false,
      display: {
        videoBar: true,
        leftText: 'No',
        rightText: '',
        rightIcon: 'https://cdn/right?sig',
        shareOptions: ['Email'],
      },
      controls: {
        swipeUp: true,
        responseButtons: true,
        commentButton: true,
        saveButton: true,
        shareButton: false,
        pauseOnShare: true,
        pausing: false,
        audioRecord: false,
        cameraRecord: false,
      },
      blocks: [
        { id: 'b1', label: 'instruction1', type: 'instructions', text: 'Welcome' },
        {
          id: 'b2',
          label: 'cat.mp4',
          randomGroup: 'A',
          type: 'video',
          videoUrl: 'https://cdn/cat?sig',
          fileName: 'cat.mp4',
          title: 'My cat',
          comments: [
            { author: 'sam', text: 'cute', likes: 4 },
            { author: 'alex', text: 'again' },
          ],
        },
        { id: 'b3', label: 'survey1', type: 'survey', prompt: 'Fun?', options: ['Yes', 'No'] },
      ],
    });
  });

  it('lists every media path once and fails clearly when a URL is missing', () => {
    expect(mediaPathsOf(study, blocks).sort()).toEqual(Object.keys(urls).sort());
    expect(() => rowsToStudy(study, blocks, {})).toThrow('No download URL');
  });

  it('reads legacy "instruction" rows as instructions', () => {
    const legacy = block({ type: 'instruction' as BlockRow['type'], body: 'Hi' });
    expect(rowsToStudy(study, [legacy], urls).blocks[0]).toMatchObject({ type: 'instructions', text: 'Hi' });
  });

  it('keeps ungrouped blocks in place under the tablet ordering rule', () => {
    const many = [
      block({ id: 'i', position: 1 }),
      ...['v1', 'v2', 'v3'].map((id, i) =>
        block({ id, position: i + 2, type: 'video', video_path: S + '/videos/x-cat.mp4', random_group: 'A' })
      ),
      block({ id: 's', position: 5, type: 'survey', prompt: 'q', options: ['a', 'b'] }),
    ];
    const ordered = orderBlocks(rowsToStudy(study, many, urls).blocks, false, () => 0);
    expect(ordered[0].id).toBe('i');
    expect(ordered[4].id).toBe('s');
    expect(
      ordered
        .slice(1, 4)
        .map((b) => b.id)
        .sort()
    ).toEqual(['v1', 'v2', 'v3']);
  });
});

const run: RunResult = {
  studyId: S,
  studyName: 'Attention',
  participantId: 'P001',
  startedAtIso: '2026-10-29T15:00:00.000Z',
  completedAtIso: '2026-10-29T15:04:00.000Z',
  blockOrder: ['b1', 'b2'],
  rows: [
    {
      blockId: 'b2',
      order: 2,
      stimulus: 'cat.mp4',
      watchTimeMs: 8123.4,
      swipedUp: 1,
      buttonPress: 'Right',
      buttonTimeMs: 2410,
      shareTimeMs: 3900,
      shareChoice: 'Email',
      commentTimeMs: null,
      saveTimeMs: 5100,
      saved: 1,
      startedAtIso: '2026-10-29T15:00:05.000Z',
    },
  ],
};

describe('toSubmitRunPayload', () => {
  it('maps a RunResult onto runs + block_views columns', () => {
    expect(toSubmitRunPayload(run, 'rid')).toEqual({
      id: 'rid',
      study_id: S,
      participant_id: 'P001',
      started_at: '2026-10-29T15:00:00.000Z',
      completed_at: '2026-10-29T15:04:00.000Z',
      views: [
        {
          block_id: 'b2',
          view_order: 2,
          stimulus: 'cat.mp4',
          started_at: '2026-10-29T15:00:05.000Z',
          watch_time_ms: 8123,
          button_press: 'Right',
          button_time_ms: 2410,
          swiped_back: true,
          share_time_ms: 3900,
          share_choice: 'Email',
          comment_time_ms: null,
          save_time_ms: 5100,
          saved: true,
        },
      ],
    });
  });
});

describe('runIdFor', () => {
  it('is a stable UUID per session, so retried uploads are recognised', () => {
    const id = runIdFor(run);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(runIdFor({ ...run })).toBe(id);
    expect(runIdFor({ ...run, participantId: 'P002' })).not.toBe(id);
    expect(runIdFor({ ...run, startedAtIso: '2026-10-29T15:00:00.001Z' })).not.toBe(id);
  });
});
