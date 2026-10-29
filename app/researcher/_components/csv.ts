import type { BlockRow, BlockViewRow, RunRow, StudyRow } from '@/app/utils/supabase/database.types';

/** Long-format export: one row per block view, every row self-describing (study, participant, run). */
export const CSV_COLUMNS = [
  'study_name',
  'study_id',
  'participant_id',
  'run_id',
  'run_started_at',
  'run_completed_at',
  'view_order',
  'block_label',
  'block_type',
  'stimulus',
  'view_started_at',
  'watch_time_ms',
  'button_press',
  'button_time_ms',
  'video_start_at',
  'video_end_at',
  'swiped_back',
  'share_time_ms',
  'share_choice',
  'comment_time_ms',
  'save_time_ms',
  'saved',
] as const;

type Cell = string | number | boolean | null | undefined;

export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
  return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function buildRunsCsv(
  study: Pick<StudyRow, 'id' | 'name'>,
  blocks: Pick<BlockRow, 'id' | 'label' | 'type'>[],
  runs: RunRow[],
  views: BlockViewRow[]
): string {
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const viewsByRun = new Map<string, BlockViewRow[]>();
  for (const view of views) viewsByRun.set(view.run_id, [...(viewsByRun.get(view.run_id) ?? []), view]);
  const lines = [CSV_COLUMNS.join(',')];
  for (const run of runs) {
    const runViews = [...(viewsByRun.get(run.id) ?? [])].sort((a, b) => a.view_order - b.view_order);
    for (const view of runViews) {
      const block = blockById.get(view.block_id);
      const row: Record<(typeof CSV_COLUMNS)[number], Cell> = {
        study_name: study.name,
        study_id: study.id,
        participant_id: run.participant_id,
        run_id: run.id,
        run_started_at: run.started_at,
        run_completed_at: run.completed_at,
        view_order: view.view_order,
        block_label: block?.label,
        block_type: block?.type,
        stimulus: view.stimulus,
        view_started_at: view.started_at,
        watch_time_ms: view.watch_time_ms,
        button_press: view.button_press,
        button_time_ms: view.button_time_ms,
        video_start_at: view.video_start_at,
        video_end_at: view.video_end_at,
        swiped_back: view.swiped_back,
        share_time_ms: view.share_time_ms,
        share_choice: view.share_choice,
        comment_time_ms: view.comment_time_ms,
        save_time_ms: view.save_time_ms,
        saved: view.saved,
      };
      lines.push(CSV_COLUMNS.map((column) => csvCell(row[column])).join(','));
    }
  }
  return lines.join('\r\n') + '\r\n';
}

export function csvFileName(studyName: string, suffix: string): string {
  const slug = (value: string) => value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'study';
  return slug(studyName) + '_' + slug(suffix) + '.csv';
}

/** Triggers a browser download; the BOM lets Excel detect UTF-8 (e.g. Chinese labels). */
export function downloadCsv(fileName: string, csv: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
