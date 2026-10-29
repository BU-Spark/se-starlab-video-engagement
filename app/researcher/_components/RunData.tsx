'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import ResearcherShell from './ResearcherShell';
import { buildRunsCsv, csvFileName, downloadCsv } from './csv';
import type { BlockViewRow, RunRow } from '@/app/utils/supabase/database.types';
import { formatDateTime, formatDuration, formatMs } from './format';
import { getStudy, getSupabase, listBlockViews, listRuns, type LoadedStudy } from './study-repository';
import styles from './StudyBuilder.module.css';
import page from './ResearcherPages.module.css';

type Filter = 'all' | 'completed' | 'incomplete';

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; loaded: LoadedStudy; runs: RunRow[] }
  | { status: 'error'; message: string };

export default function RunData({ studyId }: { studyId: string }) {
  const [supabase] = useState(getSupabase);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [views, setViews] = useState<Record<string, BlockViewRow[] | 'loading' | { error: string }>>({});
  const [downloading, setDownloading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setState({ status: 'loading' });
    setViews({});
    try {
      const [loaded, runs] = await Promise.all([getStudy(supabase, studyId), listRuns(supabase, studyId)]);
      setState(loaded ? { status: 'ready', loaded, runs } : { status: 'missing' });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Could not load data.' });
    }
  }, [supabase, studyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runs = useMemo(() => {
    if (state.status !== 'ready') return [];
    return state.runs.filter((run) =>
      filter === 'all' ? true : filter === 'completed' ? !!run.completed_at : !run.completed_at
    );
  }, [state, filter]);

  const blockById = useMemo(
    () => new Map(state.status === 'ready' ? state.loaded.blocks.map((block) => [block.id, block]) : []),
    [state]
  );

  async function viewsFor(runIds: string[]): Promise<BlockViewRow[]> {
    const cached = runIds.flatMap((id) => {
      const entry = views[id];
      return Array.isArray(entry) ? entry : [];
    });
    const missing = runIds.filter((id) => !Array.isArray(views[id]));
    if (!missing.length || !supabase) return cached;
    const fetched = await listBlockViews(supabase, missing);
    const grouped: Record<string, BlockViewRow[]> = Object.fromEntries(missing.map((id) => [id, []]));
    for (const view of fetched) grouped[view.run_id]?.push(view);
    setViews((current) => ({ ...current, ...grouped }));
    return [...cached, ...fetched];
  }

  async function toggle(run: RunRow) {
    if (open === run.id) {
      setOpen(null);
      return;
    }
    setOpen(run.id);
    if (Array.isArray(views[run.id])) return;
    setViews((current) => ({ ...current, [run.id]: 'loading' }));
    try {
      await viewsFor([run.id]);
    } catch (error) {
      setViews((current) => ({
        ...current,
        [run.id]: { error: error instanceof Error ? error.message : 'Could not load block views.' },
      }));
    }
  }

  async function download(target: RunRow[] | 'all', key: string) {
    if (state.status !== 'ready') return;
    const selected = target === 'all' ? runs : target;
    setDownloading(key);
    setActionError(null);
    try {
      const rows = await viewsFor(selected.map((run) => run.id));
      const { study, blocks } = state.loaded;
      const csv = buildRunsCsv(study, blocks, selected, rows);
      const suffix =
        target === 'all'
          ? filter === 'all'
            ? 'all_runs'
            : filter + '_runs'
          : selected[0].participant_id + '_' + selected[0].started_at.slice(0, 10);
      downloadCsv(csvFileName(study.name, suffix), csv);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not prepare the CSV.');
    } finally {
      setDownloading(null);
    }
  }

  const study = state.status === 'ready' ? state.loaded.study : null;
  const allRuns = state.status === 'ready' ? state.runs : [];
  const lastSync = allRuns.reduce<string | null>(
    (latest, run) => (!latest || run.synced_at > latest ? run.synced_at : latest),
    null
  );

  return (
    <ResearcherShell active="data" crumbs={['Studies', study?.name ?? 'Study', 'Saved data']}>
      <div className={styles.pageHeading}>
        <div>
          <span className={styles.eyebrow}>SAVED DATA</span>
          <h1>
            {study?.name ?? 'Study data'}
            <span>.</span>
          </h1>
          <p>
            {state.status === 'ready'
              ? allRuns.length +
                ' run' +
                (allRuns.length === 1 ? '' : 's') +
                ' · ' +
                allRuns.filter((run) => run.completed_at).length +
                ' completed · last sync ' +
                formatDateTime(lastSync)
              : 'Runs synced from the tablet app.'}
          </p>
        </div>
        <div className={styles.headingActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void load()}
            disabled={!supabase || state.status === 'loading'}
          >
            Refresh
          </button>
          {study && (
            <Link href={'/researcher/studies/' + study.id + '/edit'} className={styles.secondaryButton}>
              {state.status === 'ready' && state.runs.length ? 'View study' : 'Edit study'}
            </Link>
          )}
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!runs.length || downloading !== null}
            onClick={() => void download('all', 'all')}
          >
            <Icon name="arrowDown" size={16} />
            {downloading === 'all' ? 'Preparing…' : 'Download CSV (' + runs.length + ')'}
          </button>
        </div>
      </div>

      {!supabase ? (
        <div className={page.emptyPanel}>
          <h2>Supabase is not configured</h2>
          <p>Add the Supabase environment variables to .env.local to see synced runs.</p>
        </div>
      ) : state.status === 'loading' ? (
        <div className={page.emptyPanel} role="status">
          <p>Loading runs…</p>
        </div>
      ) : state.status === 'missing' ? (
        <div className={page.emptyPanel}>
          <h2>Study not found</h2>
          <p>It may have been deleted.</p>
          <Link href="/researcher/studies" className={styles.secondaryButton}>
            Back to list
          </Link>
        </div>
      ) : state.status === 'error' ? (
        <div className={styles.saveError} role="alert">
          <Icon name="info" size={17} />
          <p>{state.message}</p>
        </div>
      ) : (
        <>
          <div className={page.toolbar}>
            <div className={styles.segmented} role="group" aria-label="Filter runs">
              {(
                [
                  ['all', 'All'],
                  ['completed', 'Completed'],
                  ['incomplete', 'Incomplete'],
                ] as [Filter, string][]
              ).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
            <span className={page.subtle}>One CSV row per block view, with study and participant on every row.</span>
          </div>
          {actionError && (
            <div className={styles.saveError} role="alert">
              <Icon name="info" size={17} />
              <p>{actionError}</p>
            </div>
          )}
          {runs.length === 0 ? (
            <div className={page.emptyPanel}>
              <h2>{allRuns.length ? 'No runs match this filter' : 'No runs yet'}</h2>
              <p>Runs appear here after the tablet app syncs a participant session.</p>
            </div>
          ) : (
            <div className={page.tableCard}>
              <table className={page.table}>
                <thead>
                  <tr>
                    <th scope="col">Participant</th>
                    <th scope="col">Started</th>
                    <th scope="col">Status</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Synced</th>
                    <th scope="col">
                      <span className={styles.srOnly}>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const entry = views[run.id];
                    return (
                      <Fragment key={run.id}>
                        <tr>
                          <td data-label="Participant">
                            <span className={page.primaryCell}>{run.participant_id}</span>
                          </td>
                          <td data-label="Started">{formatDateTime(run.started_at)}</td>
                          <td data-label="Status">
                            {run.completed_at ? (
                              <span className={page.okBadge}>Completed</span>
                            ) : (
                              <span className={page.badge}>Incomplete</span>
                            )}
                          </td>
                          <td data-label="Duration">{formatDuration(run.started_at, run.completed_at)}</td>
                          <td data-label="Synced">{formatDateTime(run.synced_at)}</td>
                          <td className={page.actions}>
                            <span className={page.actionGroup}>
                              <button
                                type="button"
                                className={page.linkButton}
                                aria-expanded={open === run.id}
                                aria-controls={'views-' + run.id}
                                onClick={() => void toggle(run)}
                              >
                                Inspect {open === run.id ? '▴' : '▾'}
                              </button>
                              <button
                                type="button"
                                className={page.linkButton}
                                disabled={downloading !== null}
                                onClick={() => void download([run], run.id)}
                              >
                                {downloading === run.id ? 'Preparing…' : 'Download CSV'}
                              </button>
                            </span>
                          </td>
                        </tr>
                        {open === run.id && (
                          <tr className={page.detailRow} id={'views-' + run.id}>
                            <td colSpan={6}>
                              {entry === 'loading' || entry === undefined ? (
                                <p className={page.subtle}>Loading block views…</p>
                              ) : !Array.isArray(entry) ? (
                                <p className={styles.fieldError}>{entry.error}</p>
                              ) : entry.length === 0 ? (
                                <p className={page.subtle}>This run has no block views.</p>
                              ) : (
                                <div className={page.innerScroll}>
                                  <table className={page.innerTable}>
                                    <thead>
                                      <tr>
                                        <th scope="col">#</th>
                                        <th scope="col">Block</th>
                                        <th scope="col">Stimulus</th>
                                        <th scope="col">Watch time</th>
                                        <th scope="col">Button</th>
                                        <th scope="col">Button time</th>
                                        <th scope="col">Swiped back</th>
                                        <th scope="col">Share</th>
                                        <th scope="col">Comments opened</th>
                                        <th scope="col">Saved</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {entry.map((view) => (
                                        <tr key={view.id}>
                                          <td>{view.view_order}</td>
                                          <td>{blockById.get(view.block_id)?.label ?? '—'}</td>
                                          <td>{view.stimulus}</td>
                                          <td>{formatMs(view.watch_time_ms)}</td>
                                          <td>{view.button_press ?? '—'}</td>
                                          <td>{formatMs(view.button_time_ms)}</td>
                                          <td>{view.swiped_back ? 'Yes' : 'No'}</td>
                                          <td>
                                            {view.share_time_ms === null || view.share_time_ms === undefined
                                              ? '—'
                                              : (view.share_choice ?? '—') + ' · ' + formatMs(view.share_time_ms)}
                                          </td>
                                          <td>{formatMs(view.comment_time_ms)}</td>
                                          <td>
                                            {view.saved ? 'Yes' : 'No'}
                                            {view.save_time_ms !== null && view.save_time_ms !== undefined
                                              ? ' · first tap ' + formatMs(view.save_time_ms)
                                              : ''}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </ResearcherShell>
  );
}
