import { buildRunsCsv, buildRunsZip, csvCell, csvFileName, CSV_COLUMNS, zipFileName } from './csv';
import { crc32 } from './zip';
import { TextDecoder, TextEncoder } from 'util';
import type { BlockViewRow, RunRow } from '@/app/utils/supabase/database.types';

// jsdom has no TextEncoder/TextDecoder; the zip export uses them in the browser.
Object.assign(globalThis, { TextEncoder, TextDecoder });

const run = (id: string, participant: string): RunRow => ({
  id,
  study_id: 's1',
  participant_id: participant,
  started_at: '2026-10-20T14:00:00Z',
  completed_at: null,
  synced_at: '2026-10-20T14:10:00Z',
  recording_path: null,
  recording_started_at: null,
});
const view = (id: number, runId: string, order: number, extra: Partial<BlockViewRow> = {}): BlockViewRow => ({
  id,
  run_id: runId,
  block_id: 'b' + order,
  view_order: order,
  stimulus: 'stim' + order,
  started_at: '2026-10-20T14:00:0' + order + 'Z',
  watch_time_ms: 1000 * order,
  like_dislike: null,
  like_dislike_time_ms: null,
  survey_answer: null,
  survey_time_ms: null,
  video_start_at: null,
  video_end_at: null,
  swiped_back: false,
  pause_count: 0,
  paused_ms: 0,
  ...extra,
});

test('escapes commas, quotes and newlines; booleans become 1/0; null is empty', () => {
  expect(csvCell('a,b')).toBe('"a,b"');
  expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
  expect(csvCell(true)).toBe('1');
  expect(csvCell(false)).toBe('0');
  expect(csvCell(null)).toBe('');
});

test('one row per block view, ordered by view_order, with study and participant on every row', () => {
  const blocks = [
    { id: 'b1', label: 'instruction1', type: 'instructions' as const },
    { id: 'b2', label: 'clip.mp4', type: 'video' as const },
  ];
  const runs = [run('r1', 'P001'), run('r2', 'P002')];
  const views = [
    view(2, 'r1', 2, {
      like_dislike: 'Dislike',
      like_dislike_time_ms: 420,
      swiped_back: true,
    }),
    view(1, 'r1', 1),
    view(3, 'r2', 1),
  ];
  const lines = buildRunsCsv({ id: 's1', name: 'My, study' }, blocks, runs, views).trimEnd().split('\r\n');
  expect(lines[0]).toBe(CSV_COLUMNS.join(','));
  expect(lines).toHaveLength(4);
  expect(lines[1].startsWith('"My, study",s1,P001,r1,')).toBe(true);
  expect(lines[1]).toContain(',1,instruction1,instructions,stim1,');
  expect(lines[2]).toContain(',2,clip.mp4,video,stim2,');
  expect(lines[2].endsWith(',2000,Dislike,420,,,,,1,0,0,,')).toBe(true);
  expect(lines[3]).toContain('P002');
});

test('exports video timestamps, pauses and the run recording', () => {
  const recorded: RunRow = {
    ...run('r1', 'P001'),
    recording_path: 's1/r1.webm',
    recording_started_at: '2026-10-20T14:00:00.500Z',
  };
  const views = [
    view(1, 'r1', 1, {
      video_start_at: '2026-10-20T14:00:01.120Z',
      video_end_at: '2026-10-20T14:00:09.004Z',
      pause_count: 2,
      paused_ms: 1450,
    }),
  ];
  const [header, line] = buildRunsCsv({ id: 's1', name: 'S' }, [], [recorded], views).trimEnd().split('\r\n');
  const cells = Object.fromEntries(header.split(',').map((column, i) => [column, line.split(',')[i]]));
  expect(cells).toMatchObject({
    video_start_at: '2026-10-20T14:00:01.120Z',
    video_end_at: '2026-10-20T14:00:09.004Z',
    pause_count: '2',
    paused_ms: '1450',
    recording_path: 's1/r1.webm',
    recording_started_at: '2026-10-20T14:00:00.500Z',
  });
});

test('file names are filesystem-safe', () => {
  expect(csvFileName('Pilot: attention / v2', 'P 001')).toBe('Pilot_attention_v2_P_001.csv');
});

test('crc32 matches the standard check value', () => {
  expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
});

/** Names and contents from a stored (uncompressed) zip, read through its local headers. */
function unzip(zip: Uint8Array): Record<string, string> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const files: Record<string, string> = {};
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = decoder.decode(zip.subarray(at + 30, at + 30 + nameLength));
    files[name] = decoder.decode(zip.subarray(at + 30 + nameLength, at + 30 + nameLength + size));
    at += 30 + nameLength + size;
  }
  return files;
}

test('zip holds the combined CSV and one CSV per run, each with a BOM', () => {
  const blocks = [{ id: 'b1', label: 'instruction1', type: 'instructions' as const }];
  const second = { ...run('r2', 'P001'), started_at: '2026-10-21T09:30:00.123Z' };
  const files = unzip(
    buildRunsZip(
      { id: 's1', name: 'Pilot' },
      blocks,
      [run('r1', 'P001'), second],
      [view(1, 'r1', 1), view(2, 'r2', 1)],
      'all_runs'
    )
  );
  expect(Object.keys(files)).toEqual([
    'Pilot_all_runs.csv',
    'runs/P001_2026-10-20T14_00_00Z.csv',
    'runs/P001_2026-10-21T09_30_00Z.csv',
  ]);
  for (const text of Object.values(files)) expect(text.startsWith('﻿' + CSV_COLUMNS.join(','))).toBe(true);
  expect(files['Pilot_all_runs.csv'].trimEnd().split('\r\n')).toHaveLength(3);
  expect(files['runs/P001_2026-10-21T09_30_00Z.csv']).toContain(',r2,');
  expect(files['runs/P001_2026-10-21T09_30_00Z.csv']).not.toContain(',r1,');
  expect(zipFileName('Pilot', 'all_runs')).toBe('Pilot_all_runs.zip');
});
