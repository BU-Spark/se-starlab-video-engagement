'use client';

import { useEffect, useRef, useState } from 'react';
import Icon, { type IconName } from './Icon';
import {
  createBlock,
  createId,
  createStudy,
  moveBlock,
  validateStudy,
  type BlockType,
  type DraftBlock,
  type LocalMedia,
  type RandomizationMode,
  type StudyDraft,
} from './study-model';
import styles from './StudyBuilder.module.css';

const blockInfo: Record<BlockType, { title: string; icon: IconName; description: string }> = {
  instruction: { title: 'Instructions', icon: 'text', description: 'Give participants context and guidance.' },
  video: { title: 'Video', icon: 'video', description: 'Add a short-form video stimulus.' },
  survey: { title: 'Survey', icon: 'survey', description: 'Collect a response on a Likert scale.' },
};

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className={styles.toggleRow}>
      <div>
        <span className={styles.controlLabel}>{label}</span>
        <p>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={onChange}
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

export default function StudyBuilder() {
  const [draft, setDraft] = useState<StudyDraft>(createStudy);
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [focusBlock, setFocusBlock] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const previewUrls = useRef(new Set<string>());
  const addButton = useRef<HTMLButtonElement>(null);
  const errors = {
    ...Object.fromEntries(Object.entries(validateStudy(draft)).filter(([key]) => touched[key])),
    ...fileErrors,
  };

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    if (!draft.name && !draft.blocks.length && !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft.name, draft.blocks.length, dirty]);

  useEffect(() => {
    if (!focusBlock) return;
    const card = document.getElementById('block-' + focusBlock);
    card?.querySelector<HTMLElement>('textarea, input')?.focus();
    card?.scrollIntoView?.({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
    });
    setFocusBlock(null);
  }, [focusBlock]);

  function update(change: (current: StudyDraft) => StudyDraft) {
    setDraft(change);
    setDirty(true);
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

  function release(media: LocalMedia | null) {
    if (media) {
      URL.revokeObjectURL(media.url);
      previewUrls.current.delete(media.url);
    }
  }

  function selectMedia(
    file: File | undefined,
    kind: 'video' | 'image',
    key: string,
    previous: LocalMedia | null,
    apply: (media: LocalMedia | null) => void
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
      apply({ id: createId(), file, url, status: 'loading' });
    } catch {
      setFileErrors((current) => ({ ...current, [key]: 'Could not preview this file. Please select it again.' }));
    }
  }

  function setIcon(side: 'left' | 'right', icon: LocalMedia | null) {
    update((current) => ({
      ...current,
      settings: {
        ...current.settings,
        response_buttons: {
          ...current.settings.response_buttons,
          [side]: { ...current.settings.response_buttons[side], icon },
        },
      },
    }));
  }

  // Loading/error events from an obsolete preview must not affect a replacement.
  function markMedia(id: string, status: LocalMedia['status']) {
    setDraft((current) => {
      const left = current.settings.response_buttons.left;
      const right = current.settings.response_buttons.right;
      const mark = (media: LocalMedia | null) =>
        media?.id === id && media.status !== status ? { ...media, status } : media;
      return {
        ...current,
        settings: {
          ...current.settings,
          response_buttons: {
            ...current.settings.response_buttons,
            left: { ...left, icon: mark(left.icon) },
            right: { ...right, icon: mark(right.icon) },
          },
        },
        blocks: current.blocks.map((block) =>
          block.type === 'video' ? { ...block, media: mark(block.media) } : block
        ),
      };
    });
  }

  function addBlock(type: BlockType) {
    const block = createBlock(type);
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
    const key =
      id === 'study-name'
        ? 'name'
        : id.endsWith('-text')
          ? id.slice(0, -5) + '.text'
          : id.endsWith('-question')
            ? id.slice(0, -9) + '.question'
            : /^[0-9a-f-]{36}$/i.test(id)
              ? id + '.label'
              : null;
    if (key) setTouched((current) => ({ ...current, [key]: true }));
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

  const statusLabel = dirty ? 'Local changes · not saved' : 'New study';

  return (
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.bu}>BU</span>
          <span className={styles.brandDivider} />
          <div>
            <strong>STAR LAB</strong>
            <span>Video experiment platform</span>
          </div>
        </div>
        <span className={styles.researcherBadge}>
          <span />
          Researcher workspace
        </span>
      </header>
      <nav className={styles.nav} aria-label="Researcher navigation">
        <button type="button" disabled title="Study list will be connected in a later phase">
          List of studies <span className={styles.soon}>Soon</span>
        </button>
        <button type="button" disabled title="Data monitoring and export are owned by Engineer 3">
          Saved data <span className={styles.soon}>Soon</span>
        </button>
        <span className={styles.activeTab} aria-current="page">
          <Icon name="plus" size={16} />
          Create new
        </span>
      </nav>

      <main className={styles.main}>
        <div className={styles.breadcrumb}>
          <span>Researcher</span>
          <Icon name="chevron" size={12} />
          <span>Study builder</span>
        </div>
        <form onSubmit={(event) => event.preventDefault()} onBlur={(event) => touchField(event.target.id)} noValidate>
          <div className={styles.pageHeading}>
            <div>
              <span className={styles.eyebrow}>DESIGN YOUR EXPERIMENT</span>
              <h1>
                Create a study<span>.</span>
              </h1>
              <p>Shape the experience, one block at a time.</p>
            </div>
            <div className={styles.headingActions}>
              <span className={styles.saveIndicator} role="status">
                <span />
                {statusLabel}
              </span>
              <button
                className={styles.primaryButton}
                type="button"
                disabled
                title="Saving will be available after backend integration."
                aria-describedby="backend-notice"
              >
                <Icon name="save" size={17} />
                Save study
              </button>
            </div>
          </div>

          <div className={styles.demoNotice}>
            <Icon name="info" size={17} />
            <p>
              <strong>Frontend preview</strong>
              <span id="backend-notice">
                Saving is not connected yet. Files stay on your device; refreshing or closing this page clears your
                work.
              </span>
            </p>
            <span className={styles.demoTag}>LOCAL ONLY</span>
          </div>

          <fieldset className={styles.editorFieldset}>
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
                      onChange={(e) => update((current) => ({ ...current, name: e.target.value }))}
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
                          ['none', 'Off'],
                          ['all', 'All blocks'],
                          ['videos_only', 'Videos only'],
                        ] as [RandomizationMode, string][]
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={draft.settings.randomization.mode === value}
                          onClick={() =>
                            update((current) => ({
                              ...current,
                              settings: { ...current.settings, randomization: { mode: value } },
                            }))
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className={styles.hint}>
                      {draft.settings.randomization.mode === 'none'
                        ? 'Blocks run in the order you arrange below.'
                        : 'Order is configured here; randomization runs in the participant app.'}
                    </p>
                  </div>
                </div>
                <div className={styles.settingsColumns}>
                  <div className={styles.settingsColumn}>
                    <h3>Display</h3>
                    <Toggle
                      label="Video progress bar"
                      description="Show playback progress at the top of the video."
                      checked={draft.settings.show_video_progress}
                      onChange={() =>
                        update((current) => ({
                          ...current,
                          settings: { ...current.settings, show_video_progress: !current.settings.show_video_progress },
                        }))
                      }
                    />
                    <Toggle
                      label="Response buttons"
                      description="Show left and right buttons over the video."
                      checked={draft.settings.response_buttons.enabled}
                      onChange={() =>
                        update((current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            response_buttons: {
                              ...current.settings.response_buttons,
                              enabled: !current.settings.response_buttons.enabled,
                            },
                          },
                        }))
                      }
                    />
                    <fieldset disabled={!draft.settings.response_buttons.enabled} className={styles.buttonSettings}>
                      <legend className={styles.srOnly}>Customize response buttons</legend>
                      {(['left', 'right'] as const).map((side) => {
                        const value = draft.settings.response_buttons[side];
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
                                  {value.icon && value.icon.status !== 'error' ? (
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
                                  onChange={(e) =>
                                    update((current) => ({
                                      ...current,
                                      settings: {
                                        ...current.settings,
                                        response_buttons: {
                                          ...current.settings.response_buttons,
                                          [side]: { ...current.settings.response_buttons[side], label: e.target.value },
                                        },
                                      },
                                    }))
                                  }
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
                      description="Allow participants to revisit the previous block."
                      checked={draft.settings.allow_back_navigation}
                      onChange={() =>
                        update((current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            allow_back_navigation: !current.settings.allow_back_navigation,
                          },
                        }))
                      }
                    />
                    <Toggle
                      label="Tap to pause"
                      description="Let participants pause and resume a video."
                      checked={draft.settings.allow_pause}
                      onChange={() =>
                        update((current) => ({
                          ...current,
                          settings: { ...current.settings, allow_pause: !current.settings.allow_pause },
                        }))
                      }
                    />
                    <div className={styles.controlNote}>
                      <Icon name="info" size={17} />
                      <p>
                        These settings are passed to the participant app. This workspace configures the study; it does
                        not run an experiment.
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
                        {block.type === 'instruction' && (
                          <div className={styles.field}>
                            <label htmlFor={block.id + '-text'}>
                              Instruction text <span className={styles.required}>*</span>
                            </label>
                            <textarea
                              id={block.id + '-text'}
                              rows={4}
                              value={block.text}
                              placeholder="Tell participants what to expect and how to proceed…"
                              onChange={(e) =>
                                updateBlock(block.id, (b) =>
                                  b.type === 'instruction' ? { ...b, text: e.target.value } : b
                                )
                              }
                              aria-invalid={!!inputError('text')}
                              aria-describedby={inputError('text') ? block.id + '-text-error' : undefined}
                            />
                            <FieldError id={block.id + '-text-error'} message={inputError('text')} />
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
                                <small>Local preview only · select a browser-playable video</small>
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
                                    updateBlock(block.id, (b) => (b.type === 'video' ? { ...b, media } : b))
                                  );
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {block.media && (
                              <div className={styles.videoPreview}>
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
                                <div className={styles.mediaDetails}>
                                  <div>
                                    <strong>{block.media.file.name}</strong>
                                    <span>
                                      {(block.media.file.size / 1024 / 1024).toFixed(1)} MB ·{' '}
                                      {block.media.status === 'ready'
                                        ? 'Ready for local preview · not uploaded'
                                        : block.media.status === 'error'
                                          ? 'Preview unavailable'
                                          : 'Loading preview…'}
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
                                (block.media?.status === 'error'
                                  ? 'This browser cannot play the video. Choose another file.'
                                  : undefined)
                              }
                            />
                          </>
                        )}

                        {block.type === 'survey' && (
                          <>
                            <div className={styles.field}>
                              <label htmlFor={block.id + '-question'}>
                                Survey question <span className={styles.required}>*</span>
                              </label>
                              <textarea
                                id={block.id + '-question'}
                                rows={2}
                                value={block.question}
                                placeholder="e.g. How much did you enjoy this video?"
                                onChange={(e) =>
                                  updateBlock(block.id, (b) =>
                                    b.type === 'survey' ? { ...b, question: e.target.value } : b
                                  )
                                }
                                aria-invalid={!!inputError('question')}
                                aria-describedby={inputError('question') ? block.id + '-question-error' : undefined}
                              />
                              <FieldError id={block.id + '-question-error'} message={inputError('question')} />
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
              <span>Changes stay in this tab. No participant data is collected.</span>
            </p>
            <button
              type="button"
              className={styles.primaryButton}
              disabled
              title="Saving will be available after backend integration."
              aria-describedby="backend-notice"
            >
              <Icon name="save" size={17} />
              Save study
            </button>
          </div>
        </form>
        <footer className={styles.footer}>
          <span>
            STAR Lab <span className={styles.footerDot}>/</span> Boston University
          </span>
          <span>Researcher study builder · Local prototype</span>
        </footer>
      </main>
    </div>
  );
}
