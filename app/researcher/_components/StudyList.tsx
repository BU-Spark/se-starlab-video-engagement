'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';
import ResearcherShell from './ResearcherShell';
import { formatDateTime } from './format';
import { deleteStudy, getSupabase, listStudies, type StudySummary } from './study-repository';
import styles from './StudyBuilder.module.css';
import page from './ResearcherPages.module.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; studies: StudySummary[] }
  | { status: 'error'; message: string };

export default function StudyList() {
  const [supabase] = useState(getSupabase);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', studies: await listStudies(supabase) });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Could not load studies.' });
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(study: StudySummary) {
    if (!supabase) return;
    setBusyId(study.id);
    setActionError(null);
    try {
      await deleteStudy(supabase, study.id);
      setConfirmDelete(null);
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete the study.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ResearcherShell active="list" crumbs={['Studies']}>
      <div className={styles.pageHeading}>
        <div>
          <span className={styles.eyebrow}>YOUR EXPERIMENTS</span>
          <h1>
            Studies<span>.</span>
          </h1>
          <p>Edit a study before it runs, or open the data participants have synced.</p>
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
          <Link href="/researcher/studies/new" className={styles.primaryButton}>
            <Icon name="plus" size={16} />
            Create new
          </Link>
        </div>
      </div>

      {!supabase ? (
        <div className={page.emptyPanel}>
          <h2>Supabase is not configured</h2>
          <p>
            Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local to list saved studies.
          </p>
        </div>
      ) : state.status === 'loading' ? (
        <div className={page.emptyPanel} role="status">
          <p>Loading studies…</p>
        </div>
      ) : state.status === 'error' ? (
        <div className={styles.saveError} role="alert">
          <Icon name="info" size={17} />
          <p>{state.message}</p>
        </div>
      ) : state.studies.length === 0 ? (
        <div className={page.emptyPanel}>
          <h2>No studies yet</h2>
          <p>Create your first study to make it available to the tablet app.</p>
          <Link href="/researcher/studies/new" className={styles.primaryButton}>
            <Icon name="plus" size={16} />
            Create a study
          </Link>
        </div>
      ) : (
        <>
          {actionError && (
            <div className={styles.saveError} role="alert">
              <Icon name="info" size={17} />
              <p>{actionError}</p>
            </div>
          )}
          <div className={page.tableCard}>
            <table className={page.table}>
              <thead>
                <tr>
                  <th scope="col">Study</th>
                  <th scope="col">Blocks</th>
                  <th scope="col">Runs</th>
                  <th scope="col">Last sync</th>
                  <th scope="col">Updated</th>
                  <th scope="col">
                    <span className={styles.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.studies.map((study) => {
                  const locked = study.runCount > 0;
                  return (
                    <tr key={study.id}>
                      <td data-label="Study">
                        <Link href={'/researcher/studies/' + study.id + '/edit'} className={page.primaryCell}>
                          {study.name}
                        </Link>
                        {locked && <span className={page.badge}>Locked</span>}
                      </td>
                      <td data-label="Blocks">{study.blockCount}</td>
                      <td data-label="Runs">
                        {study.runCount}
                        {study.runCount > 0 && (
                          <span className={page.subtle}> · {study.completedRunCount} completed</span>
                        )}
                      </td>
                      <td data-label="Last sync">{formatDateTime(study.lastSyncedAt)}</td>
                      <td data-label="Updated">{formatDateTime(study.updated_at)}</td>
                      <td className={page.actions}>
                        {confirmDelete === study.id ? (
                          <span role="group" aria-label={'Confirm deleting ' + study.name} className={page.actionGroup}>
                            <button type="button" className={page.linkButton} onClick={() => setConfirmDelete(null)}>
                              Cancel
                            </button>
                            <button
                              type="button"
                              className={page.dangerLink}
                              disabled={busyId === study.id}
                              onClick={() => void remove(study)}
                            >
                              {busyId === study.id ? 'Deleting…' : 'Delete permanently'}
                            </button>
                          </span>
                        ) : (
                          <span className={page.actionGroup}>
                            <Link href={'/researcher/studies/' + study.id + '/edit'} className={page.linkButton}>
                              {locked ? 'View' : 'Edit'}
                            </Link>
                            <Link href={'/researcher/studies/' + study.id + '/data'} className={page.linkButton}>
                              View data
                            </Link>
                            <button
                              type="button"
                              className={page.dangerLink}
                              disabled={locked}
                              title={locked ? 'Studies with participant data cannot be deleted.' : undefined}
                              aria-label={'Delete ' + study.name}
                              onClick={() => setConfirmDelete(study.id)}
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ResearcherShell>
  );
}
