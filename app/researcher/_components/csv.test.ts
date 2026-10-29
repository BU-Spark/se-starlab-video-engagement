import { buildRunsCsv, csvCell, csvFileName, CSV_COLUMNS } from './csv';
import type { BlockViewRow, RunRow } from './database.types';

const run = (id: string, participant: string): RunRow => ({
  id,
  study_id: 's1',
  participant_id: participant,
  started_at: '2026-10-20T14:00:00Z',
  completed_at: null,
  synced_at: '2026-10-20T14:10:00Z',
});
const view = (id: number, runId: string, order: number, extra: Partial<BlockViewRow> = {}): BlockViewRow => ({
  id,
  run_id: runId,
  block_id: 'b' + order,
  view_order: order,
  stimulus: 'stim' + order,
  started_at: '2026-10-20T14:00:0' + order + 'Z',
  watch_time_ms: 1000 * order,
  button_press: null,
  button_time_ms: null,
  video_start_at: null,
  video_end_at: null,
  swiped_back: false,
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
    { id: 'b1', label: 'instruction1', type: 'instruction' as const },
    { id: 'b2', label: 'clip.mp4', type: 'video' as const },
  ];
  const runs = [run('r1', 'P001'), run('r2', 'P002')];
  const views = [
    view(2, 'r1', 2, { button_press: 'Left', button_time_ms: 420, swiped_back: true }),
    view(1, 'r1', 1),
    view(3, 'r2', 1),
  ];
  const lines = buildRunsCsv({ id: 's1', name: 'My, study' }, blocks, runs, views).trimEnd().split('\r\n');
  expect(lines[0]).toBe(CSV_COLUMNS.join(','));
  expect(lines).toHaveLength(4);
  expect(lines[1].startsWith('"My, study",s1,P001,r1,')).toBe(true);
  expect(lines[1]).toContain(',1,instruction1,instruction,stim1,');
  expect(lines[2]).toContain(',2,clip.mp4,video,stim2,');
  expect(lines[2].endsWith(',2000,Left,420,,,1')).toBe(true);
  expect(lines[3]).toContain('P002');
});

test('file names are filesystem-safe', () => {
  expect(csvFileName('Pilot: attention / v2', 'P 001')).toBe('Pilot_attention_v2_P_001.csv');
});
