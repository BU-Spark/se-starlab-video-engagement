import type { RunResult } from '@/app/types';
import type { BlockRow, StudyRow } from '@/app/utils/supabase/database.types';
import { orderBlocks } from '@/app/utils/runner';
import { mediaPathsOf, recordingPathFor, rowsToStudy, runIdFor, toSubmitRunPayload } from '../supabaseMapping';

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
      },
      controls: {
        swipeUp: true,
        responseButtons: true,
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
      likeDislike: 'Like',
      likeDislikeTimeMs: 2410,
      surveyAnswer: null,
      surveyTimeMs: null,
      videoStartAtIso: '2026-10-29T15:00:05.120Z',
      videoEndAtIso: '2026-10-29T15:00:13.123Z',
      pauseCount: 2,
      pausedMs: 1450.6,
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
      recording_path: null,
      recording_started_at: null,
      views: [
        {
          block_id: 'b2',
          view_order: 2,
          stimulus: 'cat.mp4',
          started_at: '2026-10-29T15:00:05.000Z',
          watch_time_ms: 8123,
          like_dislike: 'Like',
          like_dislike_time_ms: 2410,
          survey_answer: null,
          survey_time_ms: null,
          swiped_back: true,
          video_start_at: '2026-10-29T15:00:05.120Z',
          video_end_at: '2026-10-29T15:00:13.123Z',
          pause_count: 2,
          paused_ms: 1451,
        },
      ],
    });
  });
});

describe('recordings', () => {
  const recorded: RunResult = {
    ...run,
    recording: { mimeType: 'video/webm;codecs=vp8,opus', startedAtIso: '2026-10-29T15:00:00.400Z' },
  };

  it('stores the recording path and start time only when a file was uploaded', () => {
    expect(toSubmitRunPayload(recorded, 'rid', 'S/rid.webm')).toMatchObject({
      recording_path: 'S/rid.webm',
      recording_started_at: '2026-10-29T15:00:00.400Z',
    });
    // The file was lost on the tablet: the run is still stored, without a recording.
    expect(toSubmitRunPayload(recorded, 'rid', null)).toMatchObject({
      recording_path: null,
      recording_started_at: null,
    });
  });

  it('names the file after the run, with an extension for its format', () => {
    expect(recordingPathFor('study', 'rid', 'video/webm;codecs=vp8,opus')).toBe('study/rid.webm');
    expect(recordingPathFor('study', 'rid', 'video/mp4')).toBe('study/rid.mp4');
    expect(recordingPathFor('study', 'rid', 'audio/webm')).toBe('study/rid.weba');
    expect(recordingPathFor('study', 'rid', 'audio/mp4')).toBe('study/rid.m4a');
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
