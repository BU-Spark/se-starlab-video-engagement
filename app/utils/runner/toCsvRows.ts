/**
 * app/utils/runner/toCsvRows.ts
 *
 * Flattens a RunResult into the table layout from the design document:
 * Blocks | Order | Stimuli | Watch_time | Swipe_up? | Button_press | Button_time
 */

import type { RunResult } from '@/app/types';

export const CSV_HEADER = ['Blocks', 'Order', 'Stimuli', 'Watch_time', 'Swipe_up?', 'Button_press', 'Button_time'];

export function toCsvRows(run: RunResult): string[][] {
  const sessionMs = Math.round(Date.parse(run.completedAtIso) - Date.parse(run.startedAtIso));
  return [
    CSV_HEADER,
    ['Study_ID', '1', run.studyName, `${sessionMs} ms`, '0', '0', '0'],
    ['Participant_ID', '2', run.participantId, `${sessionMs} ms`, '0', '0', '0'],
    ...run.rows.map((row) => [
      row.blockId,
      String(row.order + 2),
      row.stimulus,
      `${row.watchTimeMs} ms`,
      String(row.swipedUp),
      row.buttonPress ?? '0',
      row.buttonTimeMs === null ? '0' : `${row.buttonTimeMs} ms`,
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
