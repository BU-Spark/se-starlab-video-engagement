'use client';

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import type { ButtonSide } from '@/app/types';
import { DEFAULT_SHARE_OPTIONS, ShareSheet } from '../ShareSheet';
import { CommentSheet } from '../CommentSheet';
import { VideoSlideProps } from './VideoSlide.types';
import styles from './VideoSlide.module.css';

// Material Design "thumb_up" path (Apache 2.0); thumbs down is the same shape rotated.
const THUMB_PATH =
  'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z';

// Material Design icon paths (Apache 2.0) for the optional side buttons.
const COMMENT_PATH = 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z';
const SAVE_PATH = 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z';
const SHARE_PATH = 'M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z';

type SideAction = 'comment' | 'save' | 'share';

const SIDE_ACTIONS: {
  action: SideAction;
  label: string;
  path: string;
  enabled: keyof VideoSlideProps['controls'];
}[] = [
  { action: 'comment', label: 'Comments', path: COMMENT_PATH, enabled: 'commentButton' },
  { action: 'save', label: 'Save', path: SAVE_PATH, enabled: 'saveButton' },
  { action: 'share', label: 'Share', path: SHARE_PATH, enabled: 'shareButton' },
];

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className={styles.pausedBadge} aria-label="Paused" role="img">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" fill="currentColor" />
  </svg>
);

const ThumbIcon = ({ down }: { down?: boolean }) => (
  <svg viewBox="0 0 24 24" className={clsx(styles.thumb, down && styles.thumbDown)} aria-hidden="true">
    <path d={THUMB_PATH} fill="currentColor" />
  </svg>
);

export const VideoSlide = ({
  src,
  active,
  display,
  controls,
  leftIconSrc,
  rightIconSrc,
  title,
  description,
  comments = [],
  saved = false,
  response,
  onButton,
  onShareOpen,
  onShareChoice,
  onCommentOpen,
  onSave,
}: VideoSlideProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const downAt = useRef<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState<'share' | 'comment' | null>(null);

  // Play only the visible slide; neighbours stay loaded but paused at the start.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) {
      video.pause();
      video.currentTime = 0;
      return;
    }
    setSheet(null);
    const playing = video.play();
    // If the browser blocks sound autoplay, keep the session going muted rather than stalling.
    playing?.catch(() => {
      video.muted = true;
      video.play()?.catch(() => undefined);
    });
  }, [active]);

  // Progress bar drawn every frame without re-rendering React.
  useEffect(() => {
    if (!active || !display.videoBar) return;
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video && barRef.current && video.duration) {
        barRef.current.style.transform = `scaleX(${video.currentTime / video.duration})`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, display.videoBar]);

  const caption = { title: title?.trim(), description: description?.trim() };
  const sideActions = SIDE_ACTIONS.filter(({ enabled }) => controls[enabled]);
  const hasRail = controls.responseButtons || sideActions.length > 0;

  const togglePause = () => {
    const video = videoRef.current;
    if (!video || !active || !controls.pausing) return;
    if (video.paused) {
      video.play()?.catch(() => undefined);
    } else {
      video.pause();
    }
  };

  const responseButton = (side: ButtonSide, iconSrc: string | undefined, text: string) => {
    const content = (
      <>
        <span className={styles.icon}>
          {iconSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL from the preloader
            <img src={iconSrc} alt="" className={styles.customIcon} />
          ) : (
            <ThumbIcon down={side === 'Left'} />
          )}
        </span>
        {text && <span className={styles.buttonText}>{text}</span>}
      </>
    );

    // Decorative unless the study makes them pressable: a tap falls through to the video.
    if (!controls.responseButtonsPressable) {
      return (
        <span className={clsx(styles.responseButton, styles.decorative)} data-side={side} aria-hidden="true">
          {content}
        </span>
      );
    }

    return (
      <button
        type="button"
        className={clsx(
          styles.responseButton,
          response === side && styles.chosen,
          response !== null && response !== side && styles.dimmed
        )}
        aria-pressed={response === side}
        aria-label={text || (side === 'Left' ? 'Dislike' : 'Like')}
        disabled={response !== null}
        onPointerDown={(e) => {
          downAt.current = e.timeStamp;
        }}
        onClick={(e) => {
          e.stopPropagation(); // don't also toggle pause
          onButton(side, downAt.current ?? e.timeStamp);
          downAt.current = null;
        }}
      >
        {content}
      </button>
    );
  };

  const openSheet = (which: 'share' | 'comment') => {
    setSheet(which);
    if (controls.pauseOnShare) videoRef.current?.pause();
  };

  const closeSheet = () => {
    setSheet(null);
    if (controls.pauseOnShare && active) videoRef.current?.play()?.catch(() => undefined);
  };

  const onSideTap: Record<SideAction, (timeStamp: number) => void> = {
    comment: (timeStamp) => {
      openSheet('comment');
      onCommentOpen?.(timeStamp);
    },
    save: (timeStamp) => onSave?.(timeStamp),
    share: (timeStamp) => {
      openSheet('share');
      onShareOpen?.(timeStamp);
    },
  };

  const sideButton = ({ action, label, path }: (typeof SIDE_ACTIONS)[number]) => (
    <button
      key={action}
      type="button"
      className={clsx(styles.sideButton, action === 'save' && saved && styles.saved)}
      data-action={action}
      aria-label={label}
      aria-pressed={action === 'save' ? saved : undefined}
      onPointerDown={(e) => {
        downAt.current = e.timeStamp;
      }}
      onClick={(e) => {
        e.stopPropagation(); // don't also toggle pause
        onSideTap[action](downAt.current ?? e.timeStamp);
        downAt.current = null;
      }}
    >
      <span className={styles.icon}>
        <svg viewBox="0 0 24 24" className={styles.sideIcon} aria-hidden="true">
          <path d={path} fill="currentColor" />
        </svg>
      </span>
    </button>
  );

  return (
    <div className={styles.slide} onClick={togglePause}>
      <video
        ref={videoRef}
        className={styles.video}
        src={src}
        preload="auto"
        playsInline
        loop
        disablePictureInPicture
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
      />
      <div className={styles.scrim} />
      {display.videoBar && (
        <div className={styles.barTrack}>
          <div ref={barRef} className={styles.barFill} />
        </div>
      )}
      {active && paused && controls.pausing && <PlayIcon />}
      {(caption.title || caption.description) && (
        <div className={clsx(styles.caption, hasRail && styles.captionBesideRail)}>
          {caption.title && <p className={styles.title}>{caption.title}</p>}
          {caption.description && <p className={styles.description}>{caption.description}</p>}
        </div>
      )}
      {hasRail && (
        <div className={styles.rail}>
          {controls.responseButtons && responseButton('Right', rightIconSrc, display.rightText)}
          {controls.responseButtons && responseButton('Left', leftIconSrc, display.leftText)}
          {sideActions.map(sideButton)}
        </div>
      )}
      {active && sheet === 'share' && (
        <ShareSheet
          options={display.shareOptions?.length ? display.shareOptions : DEFAULT_SHARE_OPTIONS}
          onClose={(choice) => {
            closeSheet();
            onShareChoice?.(choice);
          }}
        />
      )}
      {active && sheet === 'comment' && <CommentSheet comments={comments} onClose={closeSheet} />}
    </div>
  );
};
