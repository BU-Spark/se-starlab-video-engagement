'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';
import ResearcherShell from './ResearcherShell';
import StudyBuilder from './StudyBuilder';
import { fromStudyRows, referencedPaths, type StudyDraft } from './study-model';
import { getStudy, getSupabase, signPaths, type LoadedStudy } from './study-repository';
import styles from './StudyBuilder.module.css';
import page from './ResearcherPages.module.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; loaded: LoadedStudy; initial: StudyDraft; version: number; justSaved: boolean };

/** Loads a saved study and hands it to StudyBuilder in edit mode; reloads after each save. */
export default function StudyEditor({ studyId }: { studyId: string }) {
  const [supabase] = useState(getSupabase);
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(
    async (justSaved = false) => {
      if (!supabase) return;
      try {
        const loaded = await getStudy(supabase, studyId);
        if (!loaded) {
          setState({ status: 'missing' });
          return;
        }
        const urls = await signPaths(supabase, referencedPaths(loaded.study, loaded.blocks));
        setState((current) => ({
          status: 'ready',
          loaded,
          initial: fromStudyRows(loaded.study, loaded.blocks, urls),
          version: current.status === 'ready' ? current.version + 1 : 0,
          justSaved,
        }));
      } catch (error) {
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Could not load the study.' });
      }
    },
    [supabase, studyId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'ready') {
    return (
      <StudyBuilder
        key={state.version}
        edit={{
          loaded: state.loaded,
          initial: state.initial,
          justSaved: state.justSaved,
          onSaved: () => void load(true),
        }}
      />
    );
  }

  return (
    <ResearcherShell active="edit" crumbs={['Studies', 'Edit']}>
      <div className={styles.pageHeading}>
        <div>
          <span className={styles.eyebrow}>UPDATE YOUR EXPERIMENT</span>
          <h1>
            Edit study<span>.</span>
          </h1>
        </div>
      </div>
      {!supabase ? (
        <div className={page.emptyPanel}>
          <h2>Supabase is not configured</h2>
          <p>Add the Supabase environment variables to .env.local to edit saved studies.</p>
        </div>
      ) : state.status === 'loading' ? (
        <div className={page.emptyPanel} role="status">
          <p>Loading study…</p>
        </div>
      ) : state.status === 'missing' ? (
        <div className={page.emptyPanel}>
          <h2>Study not found</h2>
          <p>It may have been deleted.</p>
          <Link href="/researcher/studies" className={styles.secondaryButton}>
            Back to list
          </Link>
        </div>
      ) : (
        <div className={styles.saveError} role="alert">
          <Icon name="info" size={17} />
          <p>{state.message}</p>
        </div>
      )}
    </ResearcherShell>
  );
}
