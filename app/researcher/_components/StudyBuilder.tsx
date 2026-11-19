'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import BlockLibrary, {
  blockInfo,
  PositionSelect,
  clearImport,
  peekImport,
  type LibrarySelection,
} from './BlockLibrary';
import Icon from './Icon';
import ResearcherShell from './ResearcherShell';
import {
  buttonKeys,
  createBlock,
  createId,
  createStudy,
  isGeneratedLabel,
  mediaName,
  moveBlock,
  moveBlockTo,
  duplicateBlock,
  importBlocks,
  importIcon,
  insertBlocks,
  validateStudy,
  type BlockType,
  type ButtonSide,
  type DraftBlock,
  type Media,
  type RandomizationMode,
  type StudyDraft,
} from './study-model';
import {
  createStudyInSupabase,
  deleteStudy,
  getSupabase,
  SaveStudyError,
  updateStudyInSupabase,
  type LoadedStudy,
  type SaveProgress,
  loadImport,
} from './study-repository';
import styles from './StudyBuilder.module.css';

type SaveState =
  | { status: 'idle' }
  | { status: 'saving'; progress: SaveProgress }
  | { status: 'saved'; id: string }
  | { status: 'error'; message: string };

/** Edit mode: the loaded rows, the editor state built from them, and how to reload after a save. */
export interface EditContext {
  loaded: LoadedStudy;
  initial: StudyDraft;
  justSaved?: boolean;
  onSaved: () => void;
}

function progressText(progress: SaveProgress): string {
  if (progress.stage === 'checking') return 'Checking study…';
  if (progress.stage === 'saving') return 'Saving study…';
  return 'Uploading files ' + Math.min(progress.done + 1, progress.total) + ' of ' + progress.total + '…';
}

function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.toggleRow}>
      <span className={styles.controlLabel}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        className={styles.switch}
      >
        <span />
      </button>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className={styles.fieldError}>
      {message}
    </p>
  ) : null;
}

export default function StudyBuilder({ edit }: { edit?: EditContext }) {
  const router = useRouter();
  const [draft, setDraft] = useState<StudyDraft>(() => edit?.initial ?? createStudy());
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [importAt, setImportAt] = useState<number | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  // The block open in the edit popup.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Drag-and-drop in the block grid: the dragged block and where it would land.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: 'before' | 'after' } | null>(null);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>(
    edit?.justSaved ? { status: 'saved', id: edit.loaded.study.id } : { status: 'idle' }
  );
  const [confirmStudyDelete, setConfirmStudyDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [supabase] = useState(getSupabase);
  const previewUrls = useRef(new Set<string>());
  const addButton = useRef<HTMLButtonElement>(null);
  const errors = {
    ...Object.fromEntries(Object.entries(validateStudy(draft)).filter(([key]) => touched[key])),
    ...fileErrors,
    ...serverErrors,
  };
  const saving = saveState.status === 'saving';
  // Studies stay editable after participants have run them; only blocks with data can't be removed.
  const runCount = edit?.loaded.runCount ?? 0;
  // A created study locks until "Create another"; an edited one stays editable after saving.
  const locked = saving || deleting || (!edit && saveState.status === 'saved');

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // An import chosen on the Block library tab for this study (or for a new one).
  useEffect(() => {
    if (!supabase) return;
    const pending = peekImport(edit ? edit.loaded.study.id : 'new');
    if (!pending) return;
    let mounted = true;
    const icons = { right: pending.likeIcon, left: pending.dislikeIcon };
    loadImport(
      supabase,
      pending.blockIds,
      [icons.right, icons.left].filter((path): path is string => !!path)
    )
      .then(({ blocks, signedUrls }) => {
        // An editor that was replaced meanwhile leaves the import queued for the one that replaced it.
        if (!mounted) return;
        clearImport();
        applyImport(blocks, icons, pending.at, signedUrls);
      })
      .catch((error) => {
        if (!mounted) return;
        clearImport();
        setSaveState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not import from the library.',
        });
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on the draft the page opened with
  }, [supabase]);

  // Focus the first field when the edit popup opens.
  useEffect(() => {
    if (!editingId) return;
    const dialog = document.getElementById('block-editor');
    (dialog?.querySelector<HTMLElement>('textarea') ?? dialog?.querySelector<HTMLElement>('input'))?.focus();
  }, [editingId]);

  function update(change: (current: StudyDraft) => StudyDraft) {
    setDraft(change);
    setDirty(true);
    if (saveState.status === 'error' || (edit && saveState.status === 'saved')) setSaveState({ status: 'idle' });
  }

  function updateSettings(change: Partial<StudyDraft['settings']>) {
    update((current) => ({ ...current, settings: { ...current.settings, ...change } }));
  }

  function updateBlock(id: string, change: (block: DraftBlock) => DraftBlock) {
    update((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (block.id === id ? change(block) : block)),
    }));
  }

  function clearFileError(key: string) {
    setFileErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function release(media: Media | null) {
    if (media?.kind === 'local') {
      URL.revokeObjectURL(media.url);
      previewUrls.current.delete(media.url);
    }
  }

  function selectMedia(
    file: File | undefined,
    kind: 'video' | 'image',
    key: string,
    previous: Media | null,
    apply: (media: Media | null) => void
  ) {
    if (!file) return;
    const knownExtension = kind === 'video' ? /\.(mp4|webm|mov|m4v|ogv|ogg)$/i : /\.(png|jpe?g|webp|gif|svg|avif)$/i;
    if (!file.size || (!file.type.startsWith(kind + '/') && !(file.type === '' && knownExtension.test(file.name)))) {
      setFileErrors((current) => ({ ...current, [key]: 'Choose a non-empty ' + kind + ' file.' }));
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      previewUrls.current.add(url);
      release(previous);
      clearFileError(key);
      apply({ kind: 'local', id: createId(), file, url, status: 'loading' });
    } catch {
      setFileErrors((current) => ({ ...current, [key]: 'Could not preview this file. Please select it again.' }));
    }
  }

  function setIcon(side: ButtonSide, icon: Media | null) {
    updateSettings({ [buttonKeys[side].icon]: icon });
  }

  // Loading/error events from an obsolete preview must not affect a replacement.
  function markMedia(id: string, status: Media['status']) {
    setDraft((current) => {
      const mark = (media: Media | null): Media | null =>
        media?.id === id && media.status !== status ? { ...media, status } : media;
      return {
        ...current,
        settings: {
          ...current.settings,
          left_button_icon: mark(current.settings.left_button_icon),
          right_button_icon: mark(current.settings.right_button_icon),
        },
        blocks: current.blocks.map((block) =>
          block.type === 'video' ? { ...block, media: mark(block.media) } : block
        ),
      };
    });
  }

  function addBlock(type: BlockType) {
    const block = createBlock(type, draft.blocks);
    update((current) => ({ ...current, blocks: [...current.blocks, block] }));
    setShowBlockPicker(false);
    setEditingId(block.id);
  }

  function copyBlock(block: DraftBlock) {
    // A local file gets its own preview URL, so removing one copy's video never breaks the other's.
    const copyMedia = (media: Media): Media => {
      if (media.kind !== 'local') return { ...media, id: createId() };
      const url = URL.createObjectURL(media.file);
      previewUrls.current.add(url);
      return { ...media, id: createId(), url, status: 'loading' };
    };
    // Copied outside the state updater so the preview URL is created exactly once.
    const { blocks } = duplicateBlock(draft.blocks, block.id, copyMedia);
    update((current) => ({ ...current, blocks }));
  }

  function removeBlock(block: DraftBlock) {
    if (block.type === 'video') {
      release(block.media);
      clearFileError(block.id + '.media');
    }
    update((current) => ({ ...current, blocks: current.blocks.filter((item) => item.id !== block.id) }));
    setConfirmDelete(null);
    addButton.current?.focus();
  }

  function touchField(id: string) {
    const suffix = /^([0-9a-f-]{36})-(body|prompt|label|author|text|likes)$/i.exec(id);
    const key =
      id === 'study-name'
        ? 'name'
        : suffix
          ? suffix[1] + '.' + suffix[2]
          : /^[0-9a-f-]{36}$/i.test(id)
            ? id + '.label'
            : id.endsWith('-group')
              ? 'randomization'
              : null;
    if (key) setTouched((current) => ({ ...current, [key]: true }));
  }

  async function save() {
    if (!supabase || locked) return;
    const problems = validateStudy(draft);
    if (Object.keys(problems).length) {
      setTouched((current) => ({ ...current, ...Object.fromEntries(Object.keys(problems).map((key) => [key, true])) }));
      setSaveState({ status: 'error', message: 'Fix the highlighted fields before saving.' });
      // If only blocks have problems, open the first one so its fields are visible.
      const keys = Object.keys(problems);
      const firstBlock = draft.blocks.find((block) => keys.some((key) => belongsToBlock(block, key)));
      if (firstBlock && keys.every((key) => draft.blocks.some((block) => belongsToBlock(block, key)))) {
        setEditingId(firstBlock.id);
      }
      return;
    }
    setServerErrors({});
    setSaveState({ status: 'saving', progress: { stage: 'checking' } });
    const onProgress = (progress: SaveProgress) => setSaveState({ status: 'saving', progress });
    try {
      if (edit) {
        await updateStudyInSupabase(supabase, edit.loaded, draft, onProgress);
        setDirty(false);
        edit.onSaved();
        return;
      }
      const { id } = await createStudyInSupabase(supabase, draft, onProgress);
      setSaveState({ status: 'saved', id });
      setDirty(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The study could not be saved.';
      if (error instanceof SaveStudyError && error.field) setServerErrors({ [error.field]: message });
      setSaveState({ status: 'error', message });
    }
  }

  function releaseAll() {
    release(draft.settings.left_button_icon);
    release(draft.settings.right_button_icon);
    draft.blocks.forEach((block) => block.type === 'video' && release(block.media));
  }

  function discardChanges() {
    if (!edit) return;
    releaseAll();
    setDraft(edit.initial);
    setTouched({});
    setFileErrors({});
    setServerErrors({});
    setDirty(false);
    setSaveState({ status: 'idle' });
  }

  async function removeStudy() {
    if (!edit || !supabase) return;
    setDeleting(true);
    try {
      await deleteStudy(supabase, edit.loaded.study.id);
      setDirty(false);
      router.push('/researcher/studies');
    } catch (error) {
      setDeleting(false);
      setConfirmStudyDelete(false);
      setSaveState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not delete the study.',
      });
    }
  }

  function startNewStudy() {
    releaseAll();
    setDraft(createStudy());
    setTouched({});
    setFileErrors({});
    setServerErrors({});
    setDirty(false);
    setSaveState({ status: 'idle' });
    window.scrollTo?.({ top: 0 });
  }

  function belongsToBlock(block: DraftBlock, key: string) {
    return (
      key.startsWith(block.id + '.') ||
      (block.type === 'survey' && block.options.some((option) => key.startsWith(option.id + '.')))
    );
  }

  /** Adds library blocks at `at` and uses library icons for the Like/Dislike buttons. */
  function applyImport(
    rows: LibrarySelection['blocks'],
    icons: { right?: string; left?: string },
    at: number,
    signedUrls: Record<string, string>
  ) {
    const added = importBlocks(rows, draft.blocks, signedUrls);
    const iconChange: Partial<StudyDraft['settings']> = {};
    for (const side of ['right', 'left'] as const) {
      const path = icons[side];
      if (!path) continue;
      release(draft.settings[side === 'right' ? 'right_button_icon' : 'left_button_icon']);
      iconChange[side === 'right' ? 'right_button_icon' : 'left_button_icon'] = importIcon(path, signedUrls);
    }
    update((current) => ({
      ...current,
      blocks: insertBlocks(current.blocks, added, at),
      settings: { ...current.settings, ...iconChange },
    }));
    const iconCount = Object.keys(iconChange).length;
    const parts = [
      added.length ? added.length + ' block' + (added.length === 1 ? '' : 's') : '',
      iconCount ? iconCount + ' button icon' + (iconCount === 1 ? '' : 's') : '',
    ].filter(Boolean);
    setImportNotice('Imported ' + parts.join(' and ') + ' from the library. Review them, then select Save.');
  }

  /** Closes the edit popup; anything missing in that block then shows on its tile. */
  function closeEditor() {
    const block = draft.blocks.find((item) => item.id === editingId);
    if (block) {
      const missing = Object.keys(validateStudy(draft)).filter((key) => belongsToBlock(block, key));
      setTouched((current) => ({ ...current, ...Object.fromEntries(missing.map((key) => [key, true])) }));
    }
    setEditingId(null);
  }

  function blockHasErrors(block: DraftBlock) {
    return Object.keys(errors).some((key) => belongsToBlock(block, key));
  }

  /** Drops the dragged block before or after the block it was released on. */
  function dropBlock(id: string, targetId: string, side: 'before' | 'after') {
    if (id === targetId) return;
    update((current) => {
      const from = current.blocks.findIndex((block) => block.id === id);
      let to = current.blocks.findIndex((block) => block.id === targetId) + (side === 'after' ? 1 : 0);
      if (from < to) to -= 1;
      return { ...current, blocks: moveBlockTo(current.blocks, id, to) };
    });
  }

  /** What a block tile in the grid shows: the essentials, read-only. */
  function blockSummary(block: DraftBlock) {
    return (
      <>
        <strong className={styles.tileLabel}>{block.label.trim() || 'Untitled block'}</strong>
        {block.type === 'instructions' && (
          <span className={styles.tileText}>{block.body.trim() || 'No instruction text yet'}</span>
        )}
        {block.type === 'video' &&
          (block.media ? (
            <>
              {block.media.url && (
                <video
                  className={styles.tileVideo}
                  src={block.media.url + '#t=0.1'}
                  preload="metadata"
                  muted
                  playsInline
                  aria-hidden="true"
                  tabIndex={-1}
                />
              )}
              <span className={styles.tileMeta}>{mediaName(block.media)}</span>
              {block.title.trim() && <span className={styles.tileText}>{block.title.trim()}</span>}
            </>
          ) : (
            <span className={styles.tileText}>No video chosen yet</span>
          ))}
        {block.type === 'survey' && (
          <>
            <span className={styles.tileText}>{block.prompt.trim() || 'No question yet'}</span>
            <span className={styles.tileChips}>
              {block.options.map((option, i) => (
                <span key={option.id} className={styles.tileChip}>
                  {option.label.trim() || 'Option ' + (i + 1)}
                </span>
              ))}
            </span>
          </>
        )}
        {draft.settings.randomization === 'groups' && block.random_group.trim() && (
          <span className={styles.tileMeta}>Random group {block.random_group.trim()}</span>
        )}
      </>
    );
  }

  /** The full editor for one block, shown in the edit popup. */
  function blockEditor(block: DraftBlock, index: number) {
    const inputError = (key: string) => errors[block.id + '.' + key];
    return (
      <div className={styles.blockBody}>
        <div className={styles.blockMeta}>
          <div className={styles.field}>
            <label htmlFor={block.id + '-label'}>
              Block label <span className={styles.required}>*</span>
            </label>
            <input
              id={block.id + '-label'}
              value={block.label}
              autoComplete="off"
              onChange={(e) => updateBlock(block.id, (b) => ({ ...b, label: e.target.value }))}
              aria-invalid={!!inputError('label')}
              aria-describedby={inputError('label') ? block.id + '-label-error' : undefined}
            />
            <FieldError id={block.id + '-label-error'} message={inputError('label')} />
          </div>
          {draft.settings.randomization === 'groups' && (
            <div className={styles.field}>
              <label htmlFor={block.id + '-group'}>Random group</label>
              <input
                id={block.id + '-group'}
                value={block.random_group}
                placeholder="e.g. A (blank = fixed)"
                autoComplete="off"
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, random_group: e.target.value }))}
              />
            </div>
          )}
        </div>
        {block.type === 'instructions' && (
          <div className={styles.field}>
            <label htmlFor={block.id + '-body'}>
              Instruction text <span className={styles.required}>*</span>
            </label>
            <textarea
              id={block.id + '-body'}
              rows={4}
              value={block.body}
              placeholder="Tell participants what to expect and how to proceed…"
              onChange={(e) =>
                updateBlock(block.id, (b) => (b.type === 'instructions' ? { ...b, body: e.target.value } : b))
              }
              aria-invalid={!!inputError('body')}
              aria-describedby={inputError('body') ? block.id + '-body-error' : undefined}
            />
            <FieldError id={block.id + '-body-error'} message={inputError('body')} />
          </div>
        )}

        {block.type === 'video' && (
          <>
            <div className={styles.fieldLabel}>
              Video stimulus <span className={styles.required}>*</span>
            </div>
            <label className={styles.videoPicker}>
              <span className={styles.uploadIcon}>
                <Icon name="upload" size={23} />
              </span>
              <strong>{block.media ? 'Replace video' : 'Choose a video file'}</strong>
              <span className={styles.browseLabel}>Browse files</span>
              <input
                type="file"
                className={styles.fileInput}
                accept="video/*"
                aria-label={'Video file for block ' + (index + 1)}
                aria-invalid={!!inputError('media')}
                onChange={(e) => {
                  selectMedia(e.target.files?.[0], 'video', block.id + '.media', block.media, (media) =>
                    updateBlock(block.id, (b) =>
                      b.type === 'video'
                        ? {
                            ...b,
                            media,
                            label:
                              media &&
                              (isGeneratedLabel(b.label, 'video') || (b.media && b.label === mediaName(b.media)))
                                ? mediaName(media)
                                : b.label,
                          }
                        : b
                    )
                  );
                  e.target.value = '';
                }}
              />
            </label>
            {block.media && (
              <div className={styles.videoPreview}>
                {block.media.url && (
                  <video
                    key={block.media.id}
                    src={block.media.url}
                    controls
                    preload="metadata"
                    playsInline
                    aria-label={'Video preview for block ' + (index + 1)}
                    onLoadedMetadata={() => markMedia(block.media!.id, 'ready')}
                    onError={() => markMedia(block.media!.id, 'error')}
                  />
                )}
                <div className={styles.mediaDetails}>
                  <div>
                    <strong>{mediaName(block.media)}</strong>
                    {block.media.kind === 'local' && (
                      <span>{(block.media.file.size / 1024 / 1024).toFixed(1) + ' MB'}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => {
                      release(block.media);
                      clearFileError(block.id + '.media');
                      updateBlock(block.id, (b) => (b.type === 'video' ? { ...b, media: null } : b));
                    }}
                  >
                    Remove video
                  </button>
                </div>
              </div>
            )}
            <FieldError
              id={block.id + '-media-error'}
              message={
                inputError('media') ||
                (block.media?.kind === 'local' && block.media.status === 'error'
                  ? 'This browser cannot play the video. Choose another file.'
                  : undefined)
              }
            />
            <div className={styles.captionFields}>
              <div className={styles.field}>
                <label htmlFor={block.id + '-title'}>Caption title</label>
                <input
                  id={block.id + '-title'}
                  value={block.title}
                  placeholder="Optional"
                  autoComplete="off"
                  onChange={(e) =>
                    updateBlock(block.id, (b) => (b.type === 'video' ? { ...b, title: e.target.value } : b))
                  }
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={block.id + '-description'}>Caption text</label>
                <textarea
                  id={block.id + '-description'}
                  rows={2}
                  value={block.description}
                  placeholder="Optional"
                  onChange={(e) =>
                    updateBlock(block.id, (b) => (b.type === 'video' ? { ...b, description: e.target.value } : b))
                  }
                />
              </div>
            </div>
          </>
        )}

        {block.type === 'survey' && (
          <>
            <div className={styles.field}>
              <label htmlFor={block.id + '-prompt'}>
                Survey question <span className={styles.required}>*</span>
              </label>
              <textarea
                id={block.id + '-prompt'}
                rows={2}
                value={block.prompt}
                placeholder="e.g. How much did you enjoy this video?"
                onChange={(e) =>
                  updateBlock(block.id, (b) => (b.type === 'survey' ? { ...b, prompt: e.target.value } : b))
                }
                aria-invalid={!!inputError('prompt')}
                aria-describedby={inputError('prompt') ? block.id + '-prompt-error' : undefined}
              />
              <FieldError id={block.id + '-prompt-error'} message={inputError('prompt')} />
            </div>
            <div className={styles.optionsHeading}>
              <span className={styles.fieldLabel}>Response options</span>
            </div>
            <div className={styles.optionList}>
              {block.options.map((option, optionIndex) => (
                <div key={option.id}>
                  <div className={styles.optionRow}>
                    <span className={styles.optionBubble}>{optionIndex + 1}</span>
                    <label className={styles.srOnly} htmlFor={option.id}>
                      Option {optionIndex + 1} for block {index + 1}
                    </label>
                    <input
                      id={option.id}
                      value={option.label}
                      placeholder="Response label"
                      onChange={(e) =>
                        updateBlock(block.id, (b) =>
                          b.type === 'survey'
                            ? {
                                ...b,
                                options: b.options.map((o) =>
                                  o.id === option.id ? { ...o, label: e.target.value } : o
                                ),
                              }
                            : b
                        )
                      }
                      aria-invalid={!!errors[option.id + '.label']}
                      aria-describedby={errors[option.id + '.label'] ? option.id + '-error' : undefined}
                    />
                    <button
                      className={styles.iconButton}
                      type="button"
                      disabled={block.options.length <= 2}
                      aria-label={'Remove option ' + (optionIndex + 1) + ' from block ' + (index + 1)}
                      onClick={() =>
                        updateBlock(block.id, (b) =>
                          b.type === 'survey' ? { ...b, options: b.options.filter((o) => o.id !== option.id) } : b
                        )
                      }
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  <FieldError id={option.id + '-error'} message={errors[option.id + '.label']} />
                </div>
              ))}
            </div>
            <FieldError id={block.id + '-options-error'} message={inputError('options')} />
            <button
              type="button"
              className={styles.textButton}
              onClick={() =>
                updateBlock(block.id, (b) =>
                  b.type === 'survey' ? { ...b, options: [...b.options, { id: createId(), label: '' }] } : b
                )
              }
            >
              <Icon name="plus" size={15} />
              Add response option
            </button>
          </>
        )}
      </div>
    );
  }

  function saveButton() {
    return (
      <button className={styles.primaryButton} type="button" disabled={!supabase || locked} onClick={save}>
        <Icon name="save" size={17} />
        {saving ? 'Saving…' : edit ? 'Save changes' : 'Save study'}
      </button>
    );
  }

  function blockPicker() {
    return (
      <div className={styles.blockPicker} aria-label="Block types">
        {(Object.keys(blockInfo) as BlockType[]).map((type) => (
          <button key={type} type="button" className={styles.typeChoice} onClick={() => addBlock(type)}>
            <span className={styles.typeIcon} data-type={type}>
              <Icon name={blockInfo[type].icon} size={22} />
            </span>
            <strong>{blockInfo[type].title}</strong>
            <Icon name="plus" size={18} />
          </button>
        ))}
      </div>
    );
  }

  const editingIndex = draft.blocks.findIndex((block) => block.id === editingId);
  const editingBlock = editingIndex >= 0 ? draft.blocks[editingIndex] : null;

  const statusLabel =
    saveState.status === 'saving'
      ? progressText(saveState.progress)
      : saveState.status === 'saved'
        ? 'Saved to cloud'
        : dirty
          ? 'Unsaved changes'
          : null;

  return (
    <ResearcherShell
      active={edit ? 'edit' : 'new'}
      crumbs={edit ? ['Studies', edit.loaded.study.name, 'Edit'] : ['Study builder']}
    >
      <form onSubmit={(event) => event.preventDefault()} onBlur={(event) => touchField(event.target.id)} noValidate>
        <div className={styles.pageHeading}>
          <div>
            <h1>
              {edit ? 'Edit study' : 'Create a study'}
              <span>.</span>
            </h1>
          </div>
          <div className={styles.headingActions}>
            {statusLabel && (
              <span className={styles.saveIndicator} role="status">
                <span />
                {statusLabel}
              </span>
            )}
            {edit && (
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={!dirty || locked}
                onClick={discardChanges}
              >
                Discard changes
              </button>
            )}
            {saveButton()}
          </div>
        </div>

        {!supabase && (
          <div className={styles.demoNotice}>
            <Icon name="info" size={17} />
            <p>Supabase is not configured. Saving is disabled.</p>
          </div>
        )}

        {saveState.status === 'error' && (
          <div className={styles.saveError} role="alert">
            <Icon name="info" size={17} />
            <p>{saveState.message}</p>
          </div>
        )}
        {runCount > 0 && edit && (
          <div className={styles.lockNotice} role="note">
            <Icon name="info" size={17} />
            <p>
              {runCount} participant run{runCount === 1 ? '' : 's'} · Changes apply to the next participants. Blocks
              that already have participant data can be edited but not removed.
            </p>
            <Link className={styles.secondaryButton} href={'/researcher/studies/' + edit.loaded.study.id + '/data'}>
              View data
            </Link>
          </div>
        )}
        {saveState.status === 'saved' && edit && (
          <div className={styles.saveSuccess} role="status">
            <Icon name="save" size={17} />
            <p>Changes saved.</p>
            <Link className={styles.secondaryButton} href="/researcher/studies">
              Back to list
            </Link>
          </div>
        )}
        {saveState.status === 'saved' && !edit && (
          <div className={styles.saveSuccess} role="status">
            <Icon name="save" size={17} />
            <p>“{draft.name.trim()}” is saved.</p>
            <Link className={styles.secondaryButton} href="/researcher/studies">
              View in list
            </Link>
            <button type="button" className={styles.secondaryButton} onClick={startNewStudy}>
              <Icon name="plus" size={16} />
              Create another study
            </button>
          </div>
        )}

        <fieldset className={styles.editorFieldset} disabled={locked}>
          <legend className={styles.srOnly}>Create study configuration</legend>
          <section className={styles.settingsCard} aria-labelledby="settings-heading">
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>01</span>
              <div>
                <h2 id="settings-heading">Experiment settings</h2>
              </div>
              <span className={styles.sectionIcon}>
                <Icon name="flask" size={23} />
              </span>
            </div>
            <div className={styles.settingsBody}>
              <div className={styles.generalSettings}>
                <div className={styles.field}>
                  <label htmlFor="study-name">
                    Study name <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="study-name"
                    value={draft.name}
                    placeholder="e.g. Short-form video attention study"
                    autoComplete="off"
                    onChange={(e) => {
                      if (serverErrors.name) setServerErrors({});
                      update((current) => ({ ...current, name: e.target.value }));
                    }}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                  />
                  <FieldError id="name-error" message={errors.name} />
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel} id="randomization-label">
                    Randomization
                  </span>
                  <div className={styles.segmented} role="group" aria-labelledby="randomization-label">
                    {(
                      [
                        ['off', 'Off'],
                        ['all', 'All blocks'],
                        ['groups', 'By group'],
                      ] as [RandomizationMode, string][]
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={draft.settings.randomization === value}
                        onClick={() => updateSettings({ randomization: value })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <FieldError id="randomization-error" message={errors.randomization} />
                </div>
              </div>
              <div className={styles.settingsColumns}>
                <div className={styles.settingsColumn}>
                  <h3>Display</h3>
                  <Toggle
                    label="Video progress bar"
                    checked={draft.settings.show_video_bar}
                    onChange={() => updateSettings({ show_video_bar: !draft.settings.show_video_bar })}
                  />
                  <Toggle
                    label="Response buttons"
                    checked={draft.settings.show_response_buttons}
                    onChange={() => updateSettings({ show_response_buttons: !draft.settings.show_response_buttons })}
                  />
                  <fieldset disabled={!draft.settings.show_response_buttons} className={styles.buttonSettings}>
                    <legend className={styles.srOnly}>Customize response buttons</legend>
                    {(['right', 'left'] as const).map((side) => {
                      const value = {
                        label: draft.settings[buttonKeys[side].text],
                        icon: draft.settings[buttonKeys[side].icon],
                      };
                      const title = side === 'left' ? 'Left' : 'Right';
                      const iconError =
                        errors[side + '.icon'] ||
                        (value.icon?.status === 'error'
                          ? 'Image cannot be previewed. Replace or remove it.'
                          : undefined);
                      return (
                        <div className={styles.responseSetting} key={side}>
                          <span className={styles.fieldLabel}>{title} button</span>
                          <div className={styles.iconAndLabel}>
                            <div className={styles.iconUpload}>
                              <label className={styles.iconPicker} title={'Choose custom ' + side + ' button icon'}>
                                {value.icon?.url && value.icon.status !== 'error' ? (
                                  // A blob URL is a user-selected local preview, not an optimizable remote image.
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={value.icon.url}
                                    alt={title + ' button preview'}
                                    onLoad={() => markMedia(value.icon!.id, 'ready')}
                                    onError={() => markMedia(value.icon!.id, 'error')}
                                  />
                                ) : (
                                  <Icon name={side === 'left' ? 'thumbDown' : 'thumbUp'} size={23} />
                                )}
                                <span className={styles.iconUploadBadge}>
                                  <Icon name="upload" size={10} />
                                </span>
                                <input
                                  type="file"
                                  className={styles.fileInput}
                                  accept="image/*"
                                  aria-label={title + ' button icon'}
                                  aria-invalid={!!iconError}
                                  onChange={(e) => {
                                    selectMedia(e.target.files?.[0], 'image', side + '.icon', value.icon, (media) =>
                                      setIcon(side, media)
                                    );
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>
                            <div className={styles.field}>
                              <label className={styles.srOnly} htmlFor={side + '-label'}>
                                {title} button text
                              </label>
                              <input
                                id={side + '-label'}
                                value={value.label}
                                placeholder="Label (optional)"
                                onChange={(e) => updateSettings({ [buttonKeys[side].text]: e.target.value })}
                              />
                            </div>
                          </div>
                          {value.icon && (
                            <button
                              type="button"
                              className={styles.textButton}
                              onClick={() => {
                                release(value.icon);
                                clearFileError(side + '.icon');
                                setIcon(side, null);
                              }}
                            >
                              Reset {side} icon
                            </button>
                          )}
                          <FieldError id={side + '-icon-error'} message={iconError} />
                        </div>
                      );
                    })}
                  </fieldset>
                </div>
                <div className={styles.settingsColumn}>
                  <h3>Controls</h3>
                  <Toggle
                    label="Swipe back"
                    checked={draft.settings.allow_swipe_back}
                    onChange={() => updateSettings({ allow_swipe_back: !draft.settings.allow_swipe_back })}
                  />
                  <Toggle
                    label="Tap to pause"
                    checked={draft.settings.allow_pausing}
                    onChange={() => updateSettings({ allow_pausing: !draft.settings.allow_pausing })}
                  />
                  <h3 className={styles.subHeading}>Recording</h3>
                  <Toggle
                    label="Audio recording"
                    checked={draft.settings.audio_record}
                    onChange={() => updateSettings({ audio_record: !draft.settings.audio_record })}
                  />
                  <Toggle
                    label="Camera recording"
                    checked={draft.settings.camera_record}
                    onChange={() => updateSettings({ camera_record: !draft.settings.camera_record })}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className={styles.blocksSection} aria-labelledby="blocks-heading">
            <div className={styles.blocksHeading}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>02</span>
                <div>
                  <h2 id="blocks-heading">
                    Experiment blocks <span className={styles.count}>{draft.blocks.length}</span>
                  </h2>
                </div>
              </div>
              <div className={styles.blockActions}>
                <button
                  ref={addButton}
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setShowBlockPicker((shown) => !shown)}
                  aria-expanded={showBlockPicker || !draft.blocks.length}
                >
                  <Icon name="plus" size={16} />
                  Add block
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={!supabase || locked}
                  onClick={() => {
                    setImportAt(null);
                    setShowLibrary(true);
                  }}
                >
                  <Icon name="copy" size={16} />
                  Import from library
                </button>
              </div>
            </div>
            {importNotice && (
              <div className={styles.saveSuccess} role="status">
                <Icon name="copy" size={17} />
                <p>{importNotice}</p>
                <button type="button" className={styles.secondaryButton} onClick={() => setImportNotice(null)}>
                  OK
                </button>
              </div>
            )}

            {!draft.blocks.length && (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>
                  <Icon name="flask" size={30} />
                </span>
                {blockPicker()}
              </div>
            )}
            {draft.blocks.length > 0 && showBlockPicker && blockPicker()}
            <FieldError id="blocks-error" message={errors.blocks} />

            <ol className={styles.blockGrid} aria-label="Block order">
              {draft.blocks.map((block, index) => {
                const info = blockInfo[block.type];
                const needsAttention = blockHasErrors(block);
                return (
                  <li
                    key={block.id}
                    id={'block-' + block.id}
                    className={clsx(
                      styles.blockTile,
                      dragId === block.id && styles.dragging,
                      dropTarget?.id === block.id && dropTarget.side === 'before' && styles.dropBefore,
                      dropTarget?.id === block.id && dropTarget.side === 'after' && styles.dropAfter
                    )}
                    aria-label={'Block ' + (index + 1) + ': ' + info.title}
                    draggable={!locked}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', block.id);
                      setDragId(block.id);
                    }}
                    onDragOver={(e) => {
                      if (!dragId) return;
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                      if (dropTarget?.id !== block.id || dropTarget.side !== side)
                        setDropTarget({ id: block.id, side });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId && dropTarget) dropBlock(dragId, dropTarget.id, dropTarget.side);
                      setDragId(null);
                      setDropTarget(null);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDropTarget(null);
                    }}
                  >
                    <div className={styles.tileHeader}>
                      <span className={styles.dragHandle} title="Drag to reorder" aria-hidden="true">
                        <Icon name="grip" size={16} />
                      </span>
                      <span className={styles.blockNumber}>{String(index + 1).padStart(2, '0')}</span>
                      <span className={styles.blockType} data-type={block.type}>
                        <Icon name={info.icon} size={15} />
                        {info.title}
                      </span>
                      <span className={styles.blockCardSpacer} />
                      <button
                        className={styles.iconButton}
                        type="button"
                        disabled={index === 0}
                        aria-label={'Move block ' + (index + 1) + ' earlier'}
                        onClick={() =>
                          update((current) => ({ ...current, blocks: moveBlock(current.blocks, block.id, -1) }))
                        }
                      >
                        <Icon name="arrowLeft" size={15} />
                      </button>
                      <button
                        className={styles.iconButton}
                        type="button"
                        disabled={index === draft.blocks.length - 1}
                        aria-label={'Move block ' + (index + 1) + ' later'}
                        onClick={() =>
                          update((current) => ({ ...current, blocks: moveBlock(current.blocks, block.id, 1) }))
                        }
                      >
                        <Icon name="arrowRight" size={15} />
                      </button>
                      <button
                        className={styles.iconButton}
                        type="button"
                        aria-label={'Edit block ' + (index + 1)}
                        onClick={() => setEditingId(block.id)}
                      >
                        <Icon name="edit" size={15} />
                      </button>
                      <button
                        className={styles.iconButton}
                        type="button"
                        aria-label={'Duplicate block ' + (index + 1)}
                        title="Duplicate"
                        onClick={() => copyBlock(block)}
                      >
                        <Icon name="copy" size={15} />
                      </button>
                      <button
                        className={styles.deleteButton}
                        type="button"
                        aria-label={'Delete block ' + (index + 1)}
                        aria-expanded={confirmDelete === block.id}
                        onClick={() => setConfirmDelete(confirmDelete === block.id ? null : block.id)}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                    {confirmDelete === block.id && (
                      <div role="group" aria-label="Confirm block deletion" className={styles.deleteConfirmation}>
                        <span>Delete this block?</span>
                        <button type="button" onClick={() => setConfirmDelete(null)}>
                          Cancel
                        </button>
                        <button type="button" className={styles.confirmDelete} onClick={() => removeBlock(block)}>
                          Delete block
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className={styles.tileBody}
                      onClick={() => setEditingId(block.id)}
                      aria-label={'Open block ' + (index + 1) + ': ' + (block.label || 'untitled')}
                    >
                      {blockSummary(block)}
                      {needsAttention && <span className={styles.tileWarning}>Needs attention</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
            {draft.blocks.length > 0 && (
              <button
                className={styles.addAtEnd}
                type="button"
                onClick={() => {
                  setShowBlockPicker(true);
                  addButton.current?.focus();
                  addButton.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
                }}
              >
                <Icon name="plus" size={18} />
                Add another block
              </button>
            )}
          </section>
          {editingBlock && (
            <div
              className={styles.modalBackdrop}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeEditor();
              }}
            >
              <div
                id="block-editor"
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="block-editor-title"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeEditor();
                }}
              >
                <div className={styles.modalHeader}>
                  <span className={styles.blockNumber}>{String(editingIndex + 1).padStart(2, '0')}</span>
                  <h3 id="block-editor-title" className={styles.blockType} data-type={editingBlock.type}>
                    <Icon name={blockInfo[editingBlock.type].icon} size={16} />
                    Edit {blockInfo[editingBlock.type].title.toLowerCase()} block
                  </h3>
                  <span className={styles.blockCardSpacer} />
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Close block editor"
                    // Keep focus in the field until the click: its blur would show errors and move the button.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={closeEditor}
                  >
                    <Icon name="close" size={17} />
                  </button>
                </div>
                {blockEditor(editingBlock, editingIndex)}
                <div className={styles.modalFooter}>
                  <span>Changes are kept here; select Save at the bottom of the page to store them.</span>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={closeEditor}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
          {showLibrary && supabase && (
            <div
              className={styles.modalBackdrop}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setShowLibrary(false);
              }}
            >
              <div
                className={clsx(styles.modal, styles.libraryModal)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="library-title"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowLibrary(false);
                }}
              >
                <div className={styles.modalHeader}>
                  <h3 id="library-title" className={styles.blockType}>
                    <Icon name="copy" size={16} />
                    Import from library
                  </h3>
                  <span className={styles.blockCardSpacer} />
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Close library"
                    onClick={() => setShowLibrary(false)}
                  >
                    <Icon name="close" size={17} />
                  </button>
                </div>
                <div className={styles.libraryModalBody}>
                  <BlockLibrary
                    supabase={supabase}
                    excludeStudyId={edit?.loaded.study.id}
                    footer={(selection) => {
                      const labels = draft.blocks.map((block) => block.label);
                      const at = importAt ?? labels.length;
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
                          <PositionSelect id="library-position" labels={labels} value={at} onChange={setImportAt} />
                          <button
                            type="button"
                            className={styles.primaryButton}
                            disabled={!count && !iconCount}
                            onClick={() => {
                              applyImport(
                                selection.blocks,
                                { right: selection.icons.right?.path, left: selection.icons.left?.path },
                                at,
                                selection.signedUrls
                              );
                              setShowLibrary(false);
                            }}
                          >
                            Import
                          </button>
                        </>
                      );
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </fieldset>
        <div className={styles.bottomBar}>{saveButton()}</div>
        {edit && (
          <section className={styles.dangerZone} aria-labelledby="danger-heading">
            <h2 id="danger-heading">Delete study</h2>
            {confirmStudyDelete ? (
              <div role="group" aria-label="Confirm study deletion" className={styles.dangerActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setConfirmStudyDelete(false)}>
                  Cancel
                </button>
                <button type="button" className={styles.dangerButton} disabled={deleting} onClick={removeStudy}>
                  {deleting
                    ? 'Deleting…'
                    : runCount > 0
                      ? 'Delete study + ' + runCount + ' run' + (runCount === 1 ? '' : 's')
                      : 'Delete permanently'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.dangerButton}
                disabled={!supabase || saving}
                title={runCount > 0 ? 'Also deletes its participant runs and recordings.' : undefined}
                onClick={() => setConfirmStudyDelete(true)}
              >
                <Icon name="trash" size={16} />
                Delete study
              </button>
            )}
          </section>
        )}
      </form>
    </ResearcherShell>
  );
}
