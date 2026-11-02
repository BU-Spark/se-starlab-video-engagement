'use client';

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import type { LikeDislike } from '@/app/types';
import { VideoSlideProps } from './VideoSlide.types';
import styles from './VideoSlide.module.css';

// Material Design "thumb_up" path (Apache 2.0); thumbs down is the same shape rotated.
const THUMB_PATH =
  'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z';

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
  response,
  onButton,
  onVideoStart,
  onPause,
  onResume,
}: VideoSlideProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const downAt = useRef<number | null>(null);
  // True while the video is paused by the participant's tap (not by swiping away).
  const tapPaused = useRef(false);
  const [paused, setPaused] = useState(false);

  // Play only the visible slide; neighbours stay loaded but paused at the start.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) {
      tapPaused.current = false;
      video.pause();
      video.currentTime = 0;
      return;
    }
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
  const hasRail = controls.responseButtons;

  const togglePause = (timeStamp: number) => {
    const video = videoRef.current;
    if (!video || !active || !controls.pausing) return;
    if (video.paused) {
      // The resume itself is reported from the play event.
      video.play()?.catch(() => undefined);
    } else if (!tapPaused.current) {
      tapPaused.current = true;
      video.pause();
      onPause?.(timeStamp);
    }
  };

  const responseButton = (choice: LikeDislike, iconSrc: string | undefined, text: string) => (
    <button
      type="button"
      className={clsx(
        styles.responseButton,
        response === choice && styles.chosen,
        response !== null && response !== choice && styles.dimmed
      )}
      aria-pressed={response === choice}
      aria-label={text || choice}
      disabled={response !== null}
      onPointerDown={(e) => {
        downAt.current = e.timeStamp;
      }}
      onClick={(e) => {
        e.stopPropagation(); // don't also toggle pause
        onButton(choice, downAt.current ?? e.timeStamp);
        downAt.current = null;
      }}
    >
      <span className={styles.icon}>
        {iconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob URL from the preloader
          <img src={iconSrc} alt="" className={styles.customIcon} />
        ) : (
          <ThumbIcon down={choice === 'Dislike'} />
        )}
      </span>
      {text && <span className={styles.buttonText}>{text}</span>}
    </button>
  );

  return (
    <div className={styles.slide} onClick={(e) => togglePause(e.timeStamp)}>
      <video
        ref={videoRef}
        className={styles.video}
        src={src}
        preload="auto"
        playsInline
        loop
        disablePictureInPicture
        onPlay={(e) => {
          setPaused(false);
          if (active && tapPaused.current) {
            tapPaused.current = false;
            onResume?.(e.timeStamp);
          }
        }}
        onPlaying={(e) => {
          if (active) onVideoStart?.(e.timeStamp);
        }}
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
          {/* The right_button_* settings style the Like button and the left_button_* settings the Dislike button. */}
          {controls.responseButtons && responseButton('Like', rightIconSrc, display.rightText)}
          {controls.responseButtons && responseButton('Dislike', leftIconSrc, display.leftText)}
        </div>
      )}
    </div>
  );
};
