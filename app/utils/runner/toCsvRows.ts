/**
 * app/utils/runner/toCsvRows.ts
 *
 * Flattens a RunResult into the table layout from the design document:
 * Blocks | Order | Stimuli | Watch_time | Swipe_up? | Like_dislike | Like_dislike_time | Survey_answer | Survey_time
 * plus Video_start_timestamp | Video_end_timestamp | Pause_count | Paused_time, added after the original columns.
 */

import type { RunResult } from '@/app/types';

export const CSV_HEADER = [
  'Blocks',
  'Order',
  'Stimuli',
  'Watch_time',
  'Swipe_up?',
  'Like_dislike',
  'Like_dislike_time',
  'Survey_answer',
  'Survey_time',
  'Video_start_timestamp',
  'Video_end_timestamp',
  'Pause_count',
  'Paused_time',
];

/** The Study_ID / Participant_ID rows put "0" in every column after the first four */
const zeros = () => Array<string>(CSV_HEADER.length - 4).fill('0');

export function toCsvRows(run: RunResult): string[][] {
  const sessionMs = Math.round(Date.parse(run.completedAtIso) - Date.parse(run.startedAtIso));
  return [
    CSV_HEADER,
    ['Study_ID', '1', run.studyName, `${sessionMs} ms`, ...zeros()],
    ['Participant_ID', '2', run.participantId, `${sessionMs} ms`, ...zeros()],
    ...run.rows.map((row) => [
      row.blockId,
      String(row.order + 2),
      row.stimulus,
      `${row.watchTimeMs} ms`,
      String(row.swipedUp),
      row.likeDislike ?? '0',
      row.likeDislikeTimeMs === null ? '0' : `${row.likeDislikeTimeMs} ms`,
      row.surveyAnswer ?? '0',
      row.surveyTimeMs === null ? '0' : `${row.surveyTimeMs} ms`,
      row.videoStartAtIso ?? '0',
      row.videoEndAtIso ?? '0',
      String(row.pauseCount),
      `${row.pausedMs} ms`,
    ]),
  ];
}

function escapeCell(cell: string): string {
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function toCsv(run: RunResult): string {
  return toCsvRows(run)
    .map((row) => row.map(escapeCell).join(','))
    .join('\n');
}
