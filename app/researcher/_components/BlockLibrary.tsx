'use client';

import { clsx } from 'clsx';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BlockRow } from '@/app/utils/supabase/database.types';
import Icon, { type IconName } from './Icon';
import type { BlockType } from './study-model';
import { loadLibrary, type Library, type LibraryIcon } from './study-repository';
import styles from './StudyBuilder.module.css';

export const blockInfo: Record<BlockType, { title: string; icon: IconName }> = {
  instructions: { title: 'Instructions', icon: 'text' },
  video: { title: 'Video', icon: 'video' },
  survey: { title: 'Survey', icon: 'survey' },
};

/** Legacy rows may say 'instruction'; everything that is not video or survey is instructions. */
const typeOf = (row: BlockRow): BlockType =>
  row.type === 'video' ? 'video' : row.type === 'survey' ? 'survey' : 'instructions';

export interface LibrarySelection {
  /** Selected blocks, in library order. */
  blocks: BlockRow[];
  /** Icons chosen for this study's Like (right) and Dislike (left) buttons. */
  icons: { right?: LibraryIcon; left?: LibraryIcon };
  signedUrls: Record<string, string>;
}

/** An import chosen on the Block library tab, handed to the study editor it opens. */
export interface PendingImport {
  /** Study id, or 'new' for a new study. */
  target: string;
  blockIds: string[];
  at: number;
  likeIcon?: string;
  dislikeIcon?: string;
}

const PENDING_IMPORT_KEY = 'starlab-library-import';

export function queueImport(pending: PendingImport) {
  sessionStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(pending));
}

/** The queued import for this editor, or null. It stays queued until clearImport, after it is applied. */
export function peekImport(target: string): PendingImport | null {
  try {
    const raw = sessionStorage.getItem(PENDING_IMPORT_KEY);
    const pending = raw ? (JSON.parse(raw) as PendingImport) : null;
    return pending?.target === target ? pending : null;
  } catch {
    return null;
  }
}

export function clearImport() {
  try {
    sessionStorage.removeItem(PENDING_IMPORT_KEY);
  } catch {
    // Storage unavailable: nothing was queued.
  }
}

/** Where imported blocks go: 0 = start, `labels.length` = end, n = after block n. */
export function PositionSelect({
  id,
  labels,
  value,
  onChange,
}: {
  id: string;
  labels: string[];
  value: number;
  onChange: (at: number) => void;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>Where to put them</label>
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        <option value={labels.length}>At the end</option>
        {labels.length > 0 && <option value={0}>At the start</option>}
        {labels.slice(0, -1).map((label, index) => (
          <option key={index} value={index + 1}>
            After block {index + 1}
            {label ? ': ' + label : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Earlier studies as cards; opening one shows its blocks in order (and its button icons) in a popup
 * to pick from. The parent supplies the import controls through `footer`, which gets the selection.
 */
export default function BlockLibrary({
  supabase,
  excludeStudyId,
  footer,
}: {
  supabase: SupabaseClient;
  /** The study being edited: its own blocks are already in it. */
  excludeStudyId?: string;
  footer: (selection: LibrarySelection, library: Library, clear: () => void) => ReactNode;
}) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [icons, setIcons] = useState<{ right?: LibraryIcon; left?: LibraryIcon }>({});
  const [openStudyId, setOpenStudyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLibrary(supabase)
      .then((loaded) => !cancelled && setLibrary(loaded))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load the library.'));
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const studies = useMemo(() => {
    if (!library) return [];
    const query = search.trim().toLowerCase();
    const matches = (row: BlockRow) =>
      [row.label, row.body, row.prompt, row.title, row.description, row.file_name, ...(row.options ?? [])].some(
        (text) => text?.toLowerCase().includes(query)
      );
    return library.studies
      .filter((study) => study.id !== excludeStudyId)
      .map((study) => ({
        ...study,
        blocks: library.blocks.filter((row) => row.study_id === study.id),
        icons: library.icons.filter((icon) => icon.studyId === study.id),
      }))
      .filter((study) => study.blocks.length > 0 || study.icons.length > 0)
      .filter((study) => !query || study.name.toLowerCase().includes(query) || study.blocks.some(matches));
  }, [library, excludeStudyId, search]);

  if (error) {
    return (
      <div className={styles.saveError} role="alert">
        <Icon name="info" size={17} />
        <p>{error}</p>
      </div>
    );
  }
  if (!library) {
    return (
      <p className={styles.libraryEmpty} role="status">
        Loading the library…
      </p>
    );
  }

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const selection: LibrarySelection = {
    blocks: library.blocks.filter((row) => selected.includes(row.id)),
    icons,
    signedUrls: library.signedUrls,
  };
  const clear = () => {
    setSelected([]);
    setIcons({});
  };
  const openStudy = studies.find((study) => study.id === openStudyId) ?? null;
  const closeStudy = () => setOpenStudyId(null);
  const pickedIn = (study: (typeof studies)[number]) =>
    study.blocks.filter((row) => selected.includes(row.id)).length +
    study.icons.filter((icon) => icons.right?.path === icon.path || icons.left?.path === icon.path).length;

  return (
    <div className={styles.library}>
      <div className={styles.libraryToolbar}>
        <input
          type="search"
          value={search}
          placeholder="Search by study, label, text or file name"
          aria-label="Search the library"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {studies.length > 0 ? (
        <ul className={styles.blockGrid} aria-label="Earlier studies">
          {studies.map((study) => {
            const count = (type: BlockType) => study.blocks.filter((row) => typeOf(row) === type).length;
            const firstVideo = study.blocks.find((row) => row.video_path && library.signedUrls[row.video_path]);
            const picked = pickedIn(study);
            return (
              <li key={study.id}>
                <button
                  type="button"
                  className={clsx(styles.studyCard, picked > 0 && styles.librarySelected)}
                  onClick={() => setOpenStudyId(study.id)}
                  aria-label={'Open ' + study.name}
                >
                  {firstVideo ? (
                    <video
                      className={styles.tileVideo}
                      src={library.signedUrls[firstVideo.video_path!] + '#t=0.1'}
                      preload="metadata"
                      muted
                      playsInline
                      aria-hidden="true"
                      tabIndex={-1}
                    />
                  ) : (
                    <span className={styles.studyCardPlaceholder}>
                      <Icon name="flask" size={26} />
                    </span>
                  )}
                  <strong className={styles.tileLabel}>{study.name}</strong>
                  <span className={styles.studyCardCounts}>
                    {(Object.keys(blockInfo) as BlockType[])
                      .filter((type) => count(type) > 0)
                      .map((type) => (
                        <span key={type} className={styles.blockType} data-type={type}>
                          <Icon name={blockInfo[type].icon} size={14} />
                          {count(type)}
                        </span>
                      ))}
                    {study.icons.length > 0 && (
                      <span className={styles.blockType}>
                        <Icon name="thumbUp" size={14} />
                        {study.icons.length}
                      </span>
                    )}
                  </span>
                  <span className={styles.tileMeta}>
                    {study.blocks.length} block{study.blocks.length === 1 ? '' : 's'}
                    {picked > 0 && <strong className={styles.pickedBadge}>{picked} selected</strong>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.libraryEmpty}>
          {search.trim() ? 'Nothing matches your search.' : 'Nothing here yet. Saved studies show up here.'}
        </p>
      )}

      <div className={styles.libraryFooter}>{footer(selection, library, clear)}</div>

      {openStudy && (
        <div
          className={clsx(styles.modalBackdrop, styles.studyBackdrop)}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeStudy();
          }}
        >
          <div
            className={clsx(styles.modal, styles.studyModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="library-study-title"
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return;
              e.stopPropagation(); // close this list only, not the popup around it
              closeStudy();
            }}
          >
            <div className={styles.modalHeader}>
              <h3 id="library-study-title" className={styles.tileLabel}>
                {openStudy.name}
              </h3>
              <span className={styles.blockCardSpacer} />
              {openStudy.blocks.length > 0 && (
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => {
                    const ids = openStudy.blocks.map((row) => row.id);
                    const all = ids.every((id) => selected.includes(id));
                    setSelected((current) =>
                      all
                        ? current.filter((id) => !ids.includes(id))
                        : [...current, ...ids.filter((id) => !current.includes(id))]
                    );
                  }}
                >
                  {openStudy.blocks.every((row) => selected.includes(row.id)) ? 'Clear all' : 'Select all'}
                </button>
              )}
              <button type="button" className={styles.iconButton} aria-label="Close study" onClick={closeStudy}>
                <Icon name="close" size={17} />
              </button>
            </div>
            <div className={styles.studyModalBody}>
              <ol className={styles.libraryList} aria-label={'Blocks in ' + openStudy.name}>
                {openStudy.blocks.map((row, index) => {
                  const type = typeOf(row);
                  const checked = selected.includes(row.id);
                  const videoUrl = row.video_path ? library.signedUrls[row.video_path] : undefined;
                  return (
                    <li key={row.id} className={clsx(styles.libraryRow, checked && styles.librarySelected)}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(row.id)}
                          aria-label={'Select ' + row.label}
                        />
                        <span className={styles.blockNumber}>{String(index + 1).padStart(2, '0')}</span>
                        {type === 'video' &&
                          (videoUrl ? (
                            <video
                              className={styles.rowVideo}
                              src={videoUrl + '#t=0.1'}
                              preload="metadata"
                              muted
                              playsInline
                              aria-hidden="true"
                              tabIndex={-1}
                            />
                          ) : (
                            <span className={clsx(styles.rowVideo, styles.studyCardPlaceholder)}>
                              <Icon name="video" size={20} />
                            </span>
                          ))}
                        <span className={styles.rowBody}>
                          <span className={styles.blockType} data-type={type}>
                            <Icon name={blockInfo[type].icon} size={14} />
                            {blockInfo[type].title}
                          </span>
                          <strong className={styles.tileLabel}>{row.label}</strong>
                          {type === 'instructions' && <span className={styles.tileText}>{row.body}</span>}
                          {type === 'video' && (
                            <span className={styles.tileMeta}>
                              {row.file_name}
                              {row.title ? ' · ' + row.title : ''}
                            </span>
                          )}
                          {type === 'survey' && (
                            <>
                              <span className={styles.tileText}>{row.prompt}</span>
                              <span className={styles.tileChips}>
                                {(row.options ?? []).map((option, i) => (
                                  <span key={i} className={styles.tileChip}>
                                    {option}
                                  </span>
                                ))}
                              </span>
                            </>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ol>
              {openStudy.icons.length > 0 && (
                <section className={styles.libraryStudy} aria-label="Button icons">
                  <div className={styles.libraryStudyHeading}>
                    <h3>Button icons</h3>
                  </div>
                  <ul className={styles.iconLibrary}>
                    {openStudy.icons.map((icon) => {
                      const url = library.signedUrls[icon.path];
                      return (
                        <li key={icon.side} className={styles.iconLibraryItem}>
                          {url ? (
                            // Signed preview URL from the private bucket.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt={(icon.side === 'right' ? 'Like' : 'Dislike') + ' icon'} />
                          ) : (
                            <span className={styles.iconMissing}>No preview</span>
                          )}
                          <span className={styles.tileMeta}>
                            Was the {icon.side === 'right' ? 'Like' : 'Dislike'} icon
                          </span>
                          <span className={styles.iconUse}>
                            {(['right', 'left'] as const).map((side) => (
                              <button
                                key={side}
                                type="button"
                                aria-pressed={icons[side]?.path === icon.path}
                                onClick={() =>
                                  setIcons((current) => ({
                                    ...current,
                                    [side]: current[side]?.path === icon.path ? undefined : icon,
                                  }))
                                }
                              >
                                Use for {side === 'right' ? 'Like' : 'Dislike'}
                              </button>
                            ))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
            <div className={styles.modalFooter}>
              <span>{pickedIn(openStudy)} selected from this study. Selections from other studies are kept.</span>
              <button type="button" className={styles.primaryButton} onClick={closeStudy}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
