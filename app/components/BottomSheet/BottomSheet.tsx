'use client';

import type { SyntheticEvent } from 'react';
import { clsx } from 'clsx';
import { BottomSheetProps } from './BottomSheet.types';
import styles from './BottomSheet.module.css';

// Keep touches, scrolls and taps inside the sheet from swiping or pausing the video behind it.
const stop = (e: SyntheticEvent) => e.stopPropagation();

/** TikTok/Reels-style panel that slides up over the video. The video keeps playing behind it. */
export const BottomSheet = ({ heading, onDismiss, className, children }: BottomSheetProps) => {
  return (
    <div
      className={styles.backdrop}
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onWheel={stop}
      onClick={(e) => {
        stop(e);
        onDismiss();
      }}
    >
      <div
        className={clsx(styles.sheet, className)}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onClick={stop} // taps on the sheet's background don't close it
      >
        <p className={styles.heading}>{heading}</p>
        {children}
      </div>
    </div>
  );
};
