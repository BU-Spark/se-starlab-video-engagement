import type { RunResult } from '@/app/types';
import { CSV_HEADER, toCsv, toCsvRows } from '../toCsvRows';

const run: RunResult = {
  studyId: 's1',
  studyName: 'study1 name',
  participantId: 'subject1',
  startedAtIso: '2026-10-16T00:00:00.000Z',
  completedAtIso: '2026-10-16T00:00:10.000Z',
  blockOrder: ['block1', 'block2'],
  rows: [
    {
      blockId: 'block1',
      order: 1,
      stimulus: 'instruction1',
      watchTimeMs: 123000,
      swipedUp: 0,
      likeDislike: null,
      likeDislikeTimeMs: null,
      surveyAnswer: null,
      surveyTimeMs: null,
      videoStartAtIso: null,
      videoEndAtIso: null,
      pauseCount: 0,
      pausedMs: 0,
      startedAtIso: '',
    },
    {
      blockId: 'block2',
      order: 2,
      stimulus: 'survey, "one"',
      watchTimeMs: 12400,
      swipedUp: 1,
      likeDislike: null,
      likeDislikeTimeMs: null,
      surveyAnswer: 'Neutral',
      surveyTimeMs: 1034,
      videoStartAtIso: '2026-10-16T00:00:01.250Z',
      videoEndAtIso: '2026-10-16T00:00:09.000Z',
      pauseCount: 1,
      pausedMs: 800,
      startedAtIso: '',
    },
  ],
};

const zeros = ['0', '0', '0', '0', '0', '0', '0', '0', '0'];

describe('toCsvRows', () => {
  it('matches the design document column layout, with like/dislike and survey answers in separate columns', () => {
    const rows = toCsvRows(run);
    expect(rows[0]).toEqual(CSV_HEADER);
    expect(rows[1]).toEqual(['Study_ID', '1', 'study1 name', '10000 ms', ...zeros]);
    expect(rows[2]).toEqual(['Participant_ID', '2', 'subject1', '10000 ms', ...zeros]);
    expect(rows[3]).toEqual(['block1', '3', 'instruction1', '123000 ms', ...zeros.slice(1), '0 ms']);
    expect(rows[4]).toEqual([
      'block2',
      '4',
      'survey, "one"',
      '12400 ms',
      '1',
      '0',
      '0',
      'Neutral',
      '1034 ms',
      '2026-10-16T00:00:01.250Z',
      '2026-10-16T00:00:09.000Z',
      '1',
      '800 ms',
    ]);
    expect(rows.every((row) => row.length === CSV_HEADER.length)).toBe(true);
  });

  it('escapes commas and quotes in the CSV string', () => {
    expect(toCsv(run).split('\n')[4]).toBe(
      'block2,4,"survey, ""one""",12400 ms,1,0,0,Neutral,1034 ms,' +
        '2026-10-16T00:00:01.250Z,2026-10-16T00:00:09.000Z,1,800 ms'
    );
  });
});
