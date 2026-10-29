'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Icon, { type IconName } from './Icon';
import ResearcherShell from './ResearcherShell';
import {
  buttonKeys,
  createBlock,
  createComment,
  DEFAULT_SHARE_OPTIONS,
  textItems,
  createId,
  createStudy,
  isGeneratedLabel,
  mediaName,
  moveBlock,
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

const blockInfo: Record<BlockType, { title: string; icon: IconName; description: string }> = {
  instructions: { title: 'Instructions', icon: 'text', description: 'Give participants context and guidance.' },
  video: { title: 'Video', icon: 'video', description: 'Add a short-form video stimulus.' },
  survey: { title: 'Survey', icon: 'survey', description: 'Collect a response on a Likert scale.' },
};

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  badge,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <div className={styles.toggleRow}>
      <div>
        <span className={styles.controlLabel}>
          {label}
          {badge && <span className={styles.soon}>{badge}</span>}
        </span>
        <p>{description}</p>
      </div>
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
  const [focusBlock, setFocusBlock] = useState<string | null>(null);
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
  const lockedByRuns = !!edit && edit.loaded.runCount > 0;
  // A created study locks until "Create another"; an edited one stays editable after saving.
  const locked = saving || deleting || lockedByRuns || (!edit && saveState.status === 'saved');

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

  useEffect(() => {
    if (!focusBlock) return;
    const card = document.getElementById('block-' + focusBlock);
    (card?.querySelector<HTMLElement>('textarea') ?? card?.querySelector<HTMLElement>('input'))?.focus();
    card?.scrollIntoView?.({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
    });
    setFocusBlock(null);
  }, [focusBlock]);

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
    setFocusBlock(block.id);
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

  function saveButton() {
    return (
      <button
        className={styles.primaryButton}
        type="button"
        disabled={!supabase || locked}
        onClick={save}
        title={supabase ? undefined : 'Supabase is not configured for this environment.'}
        aria-describedby="backend-notice"
      >
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
            <span>
              <strong>{blockInfo[type].title}</strong>
              <small>{blockInfo[type].description}</small>
            </span>
            <Icon name="plus" size={18} />
          </button>
        ))}
      </div>
    );
  }

  const statusLabel =
    saveState.status === 'saving'
      ? progressText(saveState.progress)
      : saveState.status === 'saved'
        ? 'Saved to cloud'
        : dirty
          ? 'Unsaved changes'
          : edit
            ? lockedByRuns
              ? 'Locked · has participant data'
              : 'No unsaved changes'
            : 'New study';

  return (
    <ResearcherShell
      active={edit ? 'edit' : 'new'}
      crumbs={edit ? ['Studies', edit.loaded.study.name, 'Edit'] : ['Study builder']}
    >
      <form onSubmit={(event) => event.preventDefault()} onBlur={(event) => touchField(event.target.id)} noValidate>
        <div className={styles.pageHeading}>
          <div>
            <span className={styles.eyebrow}>{edit ? 'UPDATE YOUR EXPERIMENT' : 'DESIGN YOUR EXPERIMENT'}</span>
            <h1>
              {edit ? 'Edit study' : 'Create a study'}
              <span>.</span>
            </h1>
            <p>{edit ? 'Changes apply to future participant runs.' : 'Shape the experience, one block at a time.'}</p>
          </div>
          <div className={styles.headingActions}>
            <span className={styles.saveIndicator} role="status">
              <span />
              {statusLabel}
            </span>
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

        {supabase ? (
          <div className={styles.demoNotice}>
            <Icon name="info" size={17} />
            <p>
              <strong>Cloud saving</strong>
              <span id="backend-notice">
                {edit
                  ? 'Saving uploads new files and updates this study for the tablet app.'
                  : 'Saving uploads videos and icons to Supabase Storage and creates the study for the tablet app.'}{' '}
                Unsaved work is lost if you close this page.
              </span>
            </p>
            <span className={styles.demoTag}>SUPABASE</span>
          </div>
        ) : (
          <div className={styles.demoNotice}>
            <Icon name="info" size={17} />
            <p>
              <strong>Frontend preview</strong>
              <span id="backend-notice">
                Supabase is not configured, so saving is disabled. Add NEXT_PUBLIC_SUPABASE_URL and
                NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local to enable it.
              </span>
            </p>
            <span className={styles.demoTag}>LOCAL ONLY</span>
          </div>
        )}

        {saveState.status === 'error' && (
          <div className={styles.saveError} role="alert">
            <Icon name="info" size={17} />
            <p>{saveState.message}</p>
          </div>
        )}
        {lockedByRuns && edit && (
          <div className={styles.lockNotice} role="note">
            <Icon name="info" size={17} />
            <p>
              <strong>
                This study has {edit.loaded.runCount} participant run{edit.loaded.runCount === 1 ? '' : 's'}, so it is
                read-only.
              </strong>
              <span>Collected data refers to these blocks; editing them would change what that data means.</span>
            </p>
            <Link className={styles.secondaryButton} href={'/researcher/studies/' + edit.loaded.study.id + '/data'}>
              View data
            </Link>
          </div>
        )}
        {saveState.status === 'saved' && edit && (
          <div className={styles.saveSuccess} role="status">
            <Icon name="save" size={17} />
            <p>
              <strong>Changes saved.</strong>
              <span>The tablet app will use this version for new runs.</span>
            </p>
            <Link className={styles.secondaryButton} href="/researcher/studies">
              Back to list
            </Link>
          </div>
        )}
        {saveState.status === 'saved' && !edit && (
          <div className={styles.saveSuccess} role="status">
            <Icon name="save" size={17} />
            <p>
              <strong>“{draft.name.trim()}” is saved.</strong>
              <span>
                Study ID <code>{saveState.id}</code> is now available to the tablet app. You can edit it from the study
                list until participants run it.
              </span>
            </p>
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
                <p>Set the rules for your participant experience.</p>
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
                  <p className={styles.hint}>
                    {draft.settings.randomization === 'off'
                      ? 'Blocks run in the order you arrange below.'
                      : draft.settings.randomization === 'all'
                        ? 'Every block is shuffled for each participant.'
                        : 'Blocks with the same group name are shuffled among their own positions; ungrouped blocks stay in place.'}
                  </p>
                  <FieldError id="randomization-error" message={errors.randomization} />
                </div>
              </div>
              <div className={styles.settingsColumns}>
                <div className={styles.settingsColumn}>
                  <h3>Display</h3>
                  <Toggle
                    label="Video progress bar"
                    description="Show playback progress at the top of the video."
                    checked={draft.settings.show_video_bar}
                    onChange={() => updateSettings({ show_video_bar: !draft.settings.show_video_bar })}
                  />
                  <Toggle
                    label="Response buttons"
                    description="Show left and right buttons over the video."
                    checked={draft.settings.show_response_buttons}
                    onChange={() => updateSettings({ show_response_buttons: !draft.settings.show_response_buttons })}
                  />
                  <fieldset disabled={!draft.settings.show_response_buttons} className={styles.buttonSettings}>
                    <legend className={styles.srOnly}>Customize response buttons</legend>
                    {(['left', 'right'] as const).map((side) => {
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
                          <div className={styles.responseHeading}>
                            <span className={styles.fieldLabel}>{title} button</span>
                            <span className={styles.miniHint}>{side === 'left' ? 'Dislike' : 'Like'} by default</span>
                          </div>
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
                  <h3 className={styles.subHeading}>Side buttons</h3>
                  <Toggle
                    label="Comment button"
                    description="Opens a panel with each video's comments."
                    checked={draft.settings.comment_button}
                    onChange={() => updateSettings({ comment_button: !draft.settings.comment_button })}
                  />
                  <Toggle
                    label="Save button"
                    description="Lets participants save and unsave a video."
                    checked={draft.settings.save_button}
                    onChange={() => updateSettings({ save_button: !draft.settings.save_button })}
                  />
                  <Toggle
                    label="Share button"
                    description="Opens a share panel; the option picked is recorded."
                    checked={draft.settings.share_button}
                    onChange={() => updateSettings({ share_button: !draft.settings.share_button })}
                  />
                  {draft.settings.share_button && (
                    <div className={styles.shareOptions} role="group" aria-labelledby="share-options-label">
                      <div className={styles.optionsHeading}>
                        <span className={styles.fieldLabel} id="share-options-label">
                          Share options
                        </span>
                        <button
                          type="button"
                          className={styles.textButton}
                          onClick={() => updateSettings({ share_options: textItems(DEFAULT_SHARE_OPTIONS) })}
                        >
                          Reset to defaults
                        </button>
                      </div>
                      {draft.settings.share_options.map((option, optionIndex) => (
                        <div key={option.id}>
                          <div className={styles.optionRow}>
                            <label className={styles.srOnly} htmlFor={option.id}>
                              Share option {optionIndex + 1}
                            </label>
                            <input
                              id={option.id}
                              value={option.label}
                              placeholder="e.g. Copy link"
                              onChange={(e) =>
                                updateSettings({
                                  share_options: draft.settings.share_options.map((o) =>
                                    o.id === option.id ? { ...o, label: e.target.value } : o
                                  ),
                                })
                              }
                              aria-invalid={!!errors[option.id + '.label']}
                            />
                            <button
                              className={styles.iconButton}
                              type="button"
                              disabled={draft.settings.share_options.length <= 1}
                              aria-label={'Remove share option ' + (optionIndex + 1)}
                              onClick={() =>
                                updateSettings({
                                  share_options: draft.settings.share_options.filter((o) => o.id !== option.id),
                                })
                              }
                            >
                              <Icon name="close" size={16} />
                            </button>
                          </div>
                          <FieldError id={option.id + '-error'} message={errors[option.id + '.label']} />
                        </div>
                      ))}
                      <FieldError id="share-options-error" message={errors.share_options} />
                      <button
                        type="button"
                        className={styles.textButton}
                        onClick={() =>
                          updateSettings({
                            share_options: [...draft.settings.share_options, { id: createId(), label: '' }],
                          })
                        }
                      >
                        <Icon name="plus" size={15} />
                        Add share option
                      </button>
                    </div>
                  )}
                  <Toggle
                    label="Pause while panels are open"
                    description="Pause the video while the share or comments panel is open."
                    checked={draft.settings.pause_on_share}
                    disabled={!draft.settings.share_button && !draft.settings.comment_button}
                    onChange={() => updateSettings({ pause_on_share: !draft.settings.pause_on_share })}
                  />
                </div>
                <div className={styles.settingsColumn}>
                  <h3>Controls</h3>
                  <Toggle
                    label="Swipe back"
                    description="Allow participants to revisit the previous block."
                    checked={draft.settings.allow_swipe_back}
                    onChange={() => updateSettings({ allow_swipe_back: !draft.settings.allow_swipe_back })}
                  />
                  <Toggle
                    label="Tap to pause"
                    description="Let participants pause and resume a video."
                    checked={draft.settings.allow_pausing}
                    onChange={() => updateSettings({ allow_pausing: !draft.settings.allow_pausing })}
                  />
                  <h3 className={styles.subHeading}>Recording</h3>
                  <Toggle
                    label="Audio recording"
                    badge="Tablet support pending"
                    description="Record from the tablet microphone during the session."
                    checked={draft.settings.audio_record}
                    onChange={() => updateSettings({ audio_record: !draft.settings.audio_record })}
                  />
                  <Toggle
                    label="Camera recording"
                    badge="Tablet support pending"
                    description="Record from the front camera during the session."
                    checked={draft.settings.camera_record}
                    onChange={() => updateSettings({ camera_record: !draft.settings.camera_record })}
                  />
                  <div className={styles.controlNote}>
                    <Icon name="info" size={17} />
                    <p>
                      These settings are passed to the participant app. This workspace configures the study; it does not
                      run an experiment.
                    </p>
                  </div>
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
                  <p>Build the sequence your participants will follow.</p>
                </div>
              </div>
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
            </div>

            {!draft.blocks.length && (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>
                  <Icon name="flask" size={30} />
                </span>
                <h3>A blank canvas for your next study</h3>
                <p>
                  Start with instructions, a video, or a question.
                  <br />
                  You can change the order at any time.
                </p>
                {blockPicker()}
              </div>
            )}
            {draft.blocks.length > 0 && showBlockPicker && blockPicker()}
            <FieldError id="blocks-error" message={errors.blocks} />

            <div className={styles.blockList}>
              {draft.blocks.map((block, index) => {
                const info = blockInfo[block.type];
                const inputError = (key: string) => errors[block.id + '.' + key];
                return (
                  <article
                    className={styles.blockCard}
                    id={'block-' + block.id}
                    key={block.id}
                    aria-label={'Block ' + (index + 1) + ': ' + info.title}
                  >
                    <div className={styles.blockCardHeader}>
                      <span className={styles.blockNumber}>{String(index + 1).padStart(2, '0')}</span>
                      <span className={styles.blockType} data-type={block.type}>
                        <Icon name={info.icon} size={16} />
                        {info.title}
                      </span>
                      <span className={styles.blockCardSpacer} />
                      <button
                        className={styles.iconButton}
                        type="button"
                        disabled={index === 0}
                        aria-label={'Move block ' + (index + 1) + ' up'}
                        onClick={() =>
                          update((current) => ({ ...current, blocks: moveBlock(current.blocks, block.id, -1) }))
                        }
                      >
                        <Icon name="arrowUp" size={17} />
                      </button>
                      <button
                        className={styles.iconButton}
                        type="button"
                        disabled={index === draft.blocks.length - 1}
                        aria-label={'Move block ' + (index + 1) + ' down'}
                        onClick={() =>
                          update((current) => ({ ...current, blocks: moveBlock(current.blocks, block.id, 1) }))
                        }
                      >
                        <Icon name="arrowDown" size={17} />
                      </button>
                      <span className={styles.actionDivider} />
                      <button
                        className={styles.deleteButton}
                        type="button"
                        aria-label={'Delete block ' + (index + 1)}
                        aria-expanded={confirmDelete === block.id}
                        onClick={() => setConfirmDelete(confirmDelete === block.id ? null : block.id)}
                      >
                        <Icon name="trash" size={17} />
                      </button>
                    </div>
                    {confirmDelete === block.id && (
                      <div role="group" aria-label="Confirm block deletion" className={styles.deleteConfirmation}>
                        <span>Delete this block and its contents?</span>
                        <button type="button" onClick={() => setConfirmDelete(null)}>
                          Cancel
                        </button>
                        <button type="button" className={styles.confirmDelete} onClick={() => removeBlock(block)}>
                          Delete block
                        </button>
                      </div>
                    )}
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
                            aria-describedby={
                              inputError('label') ? block.id + '-label-error' : block.id + '-label-hint'
                            }
                          />
                          <FieldError id={block.id + '-label-error'} message={inputError('label')} />
                          <p className={styles.hint} id={block.id + '-label-hint'}>
                            Shown as the stimulus name in exported data.
                          </p>
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
                              updateBlock(block.id, (b) =>
                                b.type === 'instructions' ? { ...b, body: e.target.value } : b
                              )
                            }
                            aria-invalid={!!inputError('body')}
                            aria-describedby={inputError('body') ? block.id + '-body-error' : undefined}
                          />
                          <FieldError id={block.id + '-body-error'} message={inputError('body')} />
                          <p className={styles.hint}>Participants swipe to continue to the next block.</p>
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
                            <span>
                              <strong>{block.media ? 'Replace video' : 'Choose a video file'}</strong>
                              <small>Uploaded to cloud storage when you save · select a browser-playable video</small>
                            </span>
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
                                            (isGeneratedLabel(b.label, 'video') ||
                                              (b.media && b.label === mediaName(b.media)))
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
                                  <span>
                                    {block.media.kind === 'stored'
                                      ? block.media.url && block.media.status !== 'error'
                                        ? 'Saved in cloud storage'
                                        : 'Saved in cloud storage · preview unavailable'
                                      : (block.media.file.size / 1024 / 1024).toFixed(1) +
                                        ' MB · ' +
                                        (block.media.status === 'ready'
                                          ? 'Ready for local preview · uploads on save'
                                          : block.media.status === 'error'
                                            ? 'Preview unavailable'
                                            : 'Loading preview…')}
                                  </span>
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
                                placeholder="Optional · shown bottom-left over the video"
                                autoComplete="off"
                                onChange={(e) =>
                                  updateBlock(block.id, (b) =>
                                    b.type === 'video' ? { ...b, title: e.target.value } : b
                                  )
                                }
                              />
                            </div>
                            <div className={styles.field}>
                              <label htmlFor={block.id + '-description'}>Caption text</label>
                              <textarea
                                id={block.id + '-description'}
                                rows={2}
                                value={block.description}
                                placeholder="Optional · line breaks are kept"
                                onChange={(e) =>
                                  updateBlock(block.id, (b) =>
                                    b.type === 'video' ? { ...b, description: e.target.value } : b
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className={styles.optionsHeading}>
                            <span className={styles.fieldLabel} id={block.id + '-comments-label'}>
                              Comments
                            </span>
                            <span className={styles.miniHint}>
                              {draft.settings.comment_button
                                ? block.comments.length + ' shown in the comments panel'
                                : 'Turn on the comment button to show these'}
                            </span>
                          </div>
                          <div
                            className={styles.commentList}
                            role="group"
                            aria-labelledby={block.id + '-comments-label'}
                          >
                            {block.comments.map((comment, commentIndex) => {
                              const commentError = (key: string) => errors[comment.id + '.' + key];
                              const setComment = (change: Partial<typeof comment>) =>
                                updateBlock(block.id, (b) =>
                                  b.type === 'video'
                                    ? {
                                        ...b,
                                        comments: b.comments.map((c) =>
                                          c.id === comment.id ? { ...c, ...change } : c
                                        ),
                                      }
                                    : b
                                );
                              const name = 'comment ' + (commentIndex + 1) + ' for block ' + (index + 1);
                              return (
                                <div className={styles.commentRow} key={comment.id}>
                                  <div className={styles.commentFields}>
                                    <div className={styles.field}>
                                      <label className={styles.srOnly} htmlFor={comment.id + '-author'}>
                                        Author of {name}
                                      </label>
                                      <input
                                        id={comment.id + '-author'}
                                        value={comment.author}
                                        placeholder="Name"
                                        autoComplete="off"
                                        onChange={(e) => setComment({ author: e.target.value })}
                                        aria-invalid={!!commentError('author')}
                                      />
                                      <FieldError id={comment.id + '-author-error'} message={commentError('author')} />
                                    </div>
                                    <div className={styles.field}>
                                      <label className={styles.srOnly} htmlFor={comment.id + '-text'}>
                                        Text of {name}
                                      </label>
                                      <input
                                        id={comment.id + '-text'}
                                        value={comment.text}
                                        placeholder="Comment"
                                        autoComplete="off"
                                        onChange={(e) => setComment({ text: e.target.value })}
                                        aria-invalid={!!commentError('text')}
                                      />
                                      <FieldError id={comment.id + '-text-error'} message={commentError('text')} />
                                    </div>
                                    <div className={styles.field}>
                                      <label className={styles.srOnly} htmlFor={comment.id + '-likes'}>
                                        Likes of {name}
                                      </label>
                                      <input
                                        id={comment.id + '-likes'}
                                        value={comment.likes}
                                        placeholder="Likes"
                                        inputMode="numeric"
                                        autoComplete="off"
                                        onChange={(e) => setComment({ likes: e.target.value })}
                                        aria-invalid={!!commentError('likes')}
                                      />
                                      <FieldError id={comment.id + '-likes-error'} message={commentError('likes')} />
                                    </div>
                                  </div>
                                  <button
                                    className={styles.iconButton}
                                    type="button"
                                    aria-label={'Remove ' + name}
                                    onClick={() =>
                                      updateBlock(block.id, (b) =>
                                        b.type === 'video'
                                          ? { ...b, comments: b.comments.filter((c) => c.id !== comment.id) }
                                          : b
                                      )
                                    }
                                  >
                                    <Icon name="close" size={16} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            className={styles.textButton}
                            onClick={() =>
                              updateBlock(block.id, (b) =>
                                b.type === 'video' ? { ...b, comments: [...b.comments, createComment()] } : b
                              )
                            }
                          >
                            <Icon name="plus" size={15} />
                            Add comment
                          </button>
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
                                updateBlock(block.id, (b) =>
                                  b.type === 'survey' ? { ...b, prompt: e.target.value } : b
                                )
                              }
                              aria-invalid={!!inputError('prompt')}
                              aria-describedby={inputError('prompt') ? block.id + '-prompt-error' : undefined}
                            />
                            <FieldError id={block.id + '-prompt-error'} message={inputError('prompt')} />
                          </div>
                          <div className={styles.optionsHeading}>
                            <span className={styles.fieldLabel}>Response options</span>
                            <span className={styles.miniHint}>{block.options.length} options · minimum 2</span>
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
                                        b.type === 'survey'
                                          ? { ...b, options: b.options.filter((o) => o.id !== option.id) }
                                          : b
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
                                b.type === 'survey'
                                  ? { ...b, options: [...b.options, { id: createId(), label: '' }] }
                                  : b
                              )
                            }
                          >
                            <Icon name="plus" size={15} />
                            Add response option
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
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
        </fieldset>
        <div className={styles.bottomBar}>
          <p>
            <Icon name="info" size={16} />
            <span>
              {!supabase
                ? 'Changes stay in this tab. No participant data is collected.'
                : edit
                  ? 'Saving updates this study in Supabase.'
                  : 'Saving creates the study in Supabase. No participant data is collected here.'}
            </span>
          </p>
          {saveButton()}
        </div>
        {edit && (
          <section className={styles.dangerZone} aria-labelledby="danger-heading">
            <div>
              <h2 id="danger-heading">Delete study</h2>
              <p>
                {lockedByRuns
                  ? 'Studies with participant data cannot be deleted.'
                  : 'Removes the study, its blocks and its uploaded files. This cannot be undone.'}
              </p>
            </div>
            {confirmStudyDelete ? (
              <div role="group" aria-label="Confirm study deletion" className={styles.dangerActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setConfirmStudyDelete(false)}>
                  Cancel
                </button>
                <button type="button" className={styles.dangerButton} disabled={deleting} onClick={removeStudy}>
                  {deleting ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.dangerButton}
                disabled={lockedByRuns || !supabase || saving}
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
