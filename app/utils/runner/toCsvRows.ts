/**
 * app/utils/runner/toCsvRows.ts
 *
 * Flattens a RunResult into the table layout from the design document:
 * Blocks | Order | Stimuli | Watch_time | Swipe_up? | Button_press | Button_time
 * plus Share_time | Share_choice | Comment_time | Save_time | Saved for the side buttons,
 * added after the original columns.
 */

import type { RunResult } from '@/app/types';

export const CSV_HEADER = [
  'Blocks',
  'Order',
  'Stimuli',
  'Watch_time',
  'Swipe_up?',
  'Button_press',
  'Button_time',
  'Share_time',
  'Share_choice',
  'Comment_time',
  'Save_time',
  'Saved',
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
      row.buttonPress ?? '0',
      row.buttonTimeMs === null ? '0' : `${row.buttonTimeMs} ms`,
      row.shareTimeMs === null ? '0' : `${row.shareTimeMs} ms`,
      row.shareChoice ?? '0',
      row.commentTimeMs === null ? '0' : `${row.commentTimeMs} ms`,
      row.saveTimeMs === null ? '0' : `${row.saveTimeMs} ms`,
      String(row.saved),
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
