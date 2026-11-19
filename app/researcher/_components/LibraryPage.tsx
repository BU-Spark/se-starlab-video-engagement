'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import BlockLibrary, { PositionSelect, queueImport, type LibrarySelection } from './BlockLibrary';
import ResearcherShell from './ResearcherShell';
import { getSupabase, type Library } from './study-repository';
import styles from './StudyBuilder.module.css';
import page from './ResearcherPages.module.css';

const NEW_STUDY = 'new';

/** The "Block library" tab: everything from earlier studies, to import into a study. */
export default function LibraryPage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [target, setTarget] = useState(NEW_STUDY);
  const [at, setAt] = useState<number | null>(null);

  const footer = (selection: LibrarySelection, library: Library) => {
    const labels = library.blocks.filter((row) => row.study_id === target).map((row) => row.label);
    const position = at === null || at > labels.length ? labels.length : at;
    const count = selection.blocks.length;
    const iconCount = Number(!!selection.icons.right) + Number(!!selection.icons.left);
    return (
      <>
        <p className={styles.librarySummary}>
          <strong>{count}</strong> block{count === 1 ? '' : 's'}
          {iconCount > 0 && (
            <>
              {' '}
              and <strong>{iconCount}</strong> icon{iconCount === 1 ? '' : 's'}
            </>
          )}{' '}
          selected
        </p>
        <div className={styles.field}>
          <label htmlFor="import-target">Import into</label>
          <select
            id="import-target"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setAt(null);
            }}
          >
            <option value={NEW_STUDY}>A new study</option>
            {library.studies.map((study) => (
              <option key={study.id} value={study.id}>
                {study.name}
              </option>
            ))}
          </select>
        </div>
        {target !== NEW_STUDY && (
          <PositionSelect id="import-position" labels={labels} value={position} onChange={setAt} />
        )}
        <button
          type="button"
          className={styles.primaryButton}
          disabled={!count && !iconCount}
          onClick={() => {
            // Handed over in session storage: changing the editor's URL afterwards would reload it.
            queueImport({
              target,
              blockIds: selection.blocks.map((row) => row.id),
              at: position,
              likeIcon: selection.icons.right?.path,
              dislikeIcon: selection.icons.left?.path,
            });
            router.push(target === NEW_STUDY ? '/researcher/studies/new' : '/researcher/studies/' + target + '/edit');
          }}
        >
          Import
        </button>
      </>
    );
  };

  return (
    <ResearcherShell active="library" crumbs={['Block library']}>
      <div className={styles.pageHeading}>
        <div>
          <h1>
            Block library<span>.</span>
          </h1>
          <p>
            Every block, video and button icon from earlier studies. Select what you need and import it into a study
            instead of building it again. Imports open in the study editor; nothing is saved until you select Save.
          </p>
        </div>
      </div>
      {supabase ? (
        <BlockLibrary supabase={supabase} footer={footer} />
      ) : (
        <div className={page.emptyPanel}>
          <h2>Supabase is not configured</h2>
        </div>
      )}
    </ResearcherShell>
  );
}
