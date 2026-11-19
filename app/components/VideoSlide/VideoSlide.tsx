'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { clsx } from 'clsx';
import type { LikeDislike } from '@/app/types';
import { VideoSlideProps } from './VideoSlide.types';
import styles from './VideoSlide.module.css';

// Material Design icons (Apache 2.0). Thumbs down is the thumbs-up shape rotated.
const THUMB_FILLED =
  'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z';
const THUMB_OUTLINE =
  'M21 8h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2c0-1.1-.9-2-2-2zm0 4l-3 7H9V9l4.34-4.34L12.23 10H21v2zM1 9h4v12H1z';
const PLAY = 'M8 5v14l11-7z';
const PAUSE = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
const SOUND_ON =
  'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z';
const SOUND_OFF =
  'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z';

const Icon = ({ path, className }: { path: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d={path} fill="currentColor" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className={styles.pausedBadge} aria-label="Paused" role="img">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" fill="currentColor" />
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
  muted: mutedProp,
  onMutedChange,
  volume: volumeProp,
  onVolumeChange,
}: VideoSlideProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  // Percent played, for screen readers (the visible bar is drawn every frame below).
  const [position, setPosition] = useState(0);
  const downAt = useRef<number | null>(null);
  // True while the video is paused by the participant's tap (not by swiping away).
  const tapPaused = useRef(false);
  const [paused, setPaused] = useState(false);
  // The session normally owns the sound settings so they carry over to the next video, as on Shorts.
  const [localMuted, setLocalMuted] = useState(false);
  const [localVolume, setLocalVolume] = useState(1);
  const muted = mutedProp ?? localMuted;
  const setMuted = onMutedChange ?? setLocalMuted;
  const volume = volumeProp ?? localVolume;
  const setVolume = onVolumeChange ?? setLocalVolume;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    // iPad Safari ignores this (only the hardware buttons change volume there); muting still works.
    video.volume = volume;
  }, [muted, volume]);

  const changeVolume = (value: number) => {
    if (value === 0) {
      setMuted(true); // keep the last volume for when sound comes back on
    } else {
      setVolume(value);
      setMuted(false);
    }
  };

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
      setMuted(true);
      video.play()?.catch(() => undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the slide becoming visible
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

  // Click or drag the progress bar to jump to that point in the video, as on YouTube.
  const seekTo = (clientX: number) => {
    const video = videoRef.current;
    const track = scrubRef.current;
    if (!video || !track || !video.duration) return;
    const rect = track.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    if (!Number.isFinite(fraction)) return;
    video.currentTime = fraction * video.duration;
    if (barRef.current) barRef.current.style.transform = `scaleX(${fraction})`;
  };

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

  // Always labelled Like/Dislike: the old per-study button text could contradict the thumb.
  const responseButton = (choice: LikeDislike, iconSrc: string | undefined) => {
    const chosen = response === choice;
    return (
      <button
        type="button"
        className={clsx(styles.responseButton, chosen && styles.chosen, response !== null && !chosen && styles.dimmed)}
        aria-pressed={chosen}
        aria-label={choice}
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
        <span className={styles.circle}>
          {iconSrc ? (
            // Custom icon from the study settings (PNG, SVG or animated GIF).
            // eslint-disable-next-line @next/next/no-img-element -- blob URL from the preloader
            <img src={iconSrc} alt="" className={styles.customIcon} />
          ) : (
            <Icon
              path={chosen ? THUMB_FILLED : THUMB_OUTLINE}
              className={clsx(styles.thumb, choice === 'Dislike' && styles.thumbDown)}
            />
          )}
        </span>
        <span className={styles.buttonText}>{choice}</span>
      </button>
    );
  };

  return (
    <div className={styles.slide} onClick={(e) => togglePause(e.timeStamp)}>
      <div className={styles.stage}>
        <div className={styles.frame}>
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
            onTimeUpdate={(e) => {
              const { currentTime, duration } = e.currentTarget;
              if (duration) setPosition(Math.round((currentTime / duration) * 100));
            }}
          />
          <div className={styles.scrim} />
          {display.videoBar && (
            <div
              ref={scrubRef}
              className={clsx(styles.scrub, scrubbing && styles.scrubbing)}
              role="slider"
              aria-label="Video position"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={position}
              // The bar's touches are its own: no swipe to the next block and no tap-to-pause.
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (!active) return;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                setScrubbing(true);
                seekTo(e.clientX);
              }}
              onPointerMove={(e) => {
                e.stopPropagation();
                if (scrubbing) seekTo(e.clientX);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                setScrubbing(false);
              }}
              onPointerCancel={(e) => {
                e.stopPropagation();
                setScrubbing(false);
              }}
            >
              <div className={styles.barTrack}>
                <div ref={barRef} className={styles.barFill} />
              </div>
            </div>
          )}
          {active && paused && controls.pausing && <PlayIcon />}
          <div className={styles.topBar}>
            {controls.pausing && (
              <button
                type="button"
                className={styles.topButton}
                aria-label={paused ? 'Play' : 'Pause'}
                onClick={(e) => {
                  e.stopPropagation(); // handled here, not by the tap-anywhere handler
                  togglePause(e.timeStamp);
                }}
              >
                <Icon path={paused ? PLAY : PAUSE} className={styles.topIcon} />
              </button>
            )}
            {/* Hovering the sound button slides a volume bar out to its right; clicking the icon mutes. */}
            <div
              className={styles.sound}
              onClick={(e) => e.stopPropagation()}
              // Dragging the volume bar must not start a swipe to the next block.
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.soundButton}
                aria-label={muted ? 'Unmute' : 'Mute'}
                aria-pressed={muted}
                onClick={() => setMuted(!muted)}
              >
                <Icon path={muted || volume === 0 ? SOUND_OFF : SOUND_ON} className={styles.topIcon} />
              </button>
              <input
                type="range"
                className={styles.volume}
                aria-label="Volume"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                style={{ '--level': `${(muted ? 0 : volume) * 100}%` } as CSSProperties}
              />
            </div>
          </div>
          {(caption.title || caption.description) && (
            <div className={styles.caption}>
              {caption.title && <p className={styles.title}>{caption.title}</p>}
              {caption.description && <p className={styles.description}>{caption.description}</p>}
            </div>
          )}
        </div>
        {hasRail && (
          <div className={styles.rail}>
            {/* The right_button_* settings style the Like button and the left_button_* settings the Dislike button. */}
            {responseButton('Like', rightIconSrc)}
            {responseButton('Dislike', leftIconSrc)}
          </div>
        )}
      </div>
    </div>
  );
};
