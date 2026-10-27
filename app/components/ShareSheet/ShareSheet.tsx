'use client';

import { BottomSheet } from '../BottomSheet';
import { ShareSheetProps } from './ShareSheet.types';
import styles from './ShareSheet.module.css';

export const CANCEL_CHOICE = 'Cancel';
/** Used when the study does not set its own `display.shareOptions` */
export const DEFAULT_SHARE_OPTIONS = ['Copy link', 'Messages', 'Email', 'Repost', 'More'];

const ICON_COLORS = ['#5b5b5b', '#2fb84f', '#2f7cf6', '#fe2c55', '#8e44ad', '#f39c12'];

/** Share panel with a row of share targets. Nothing is actually shared. */
export const ShareSheet = ({ options, onClose }: ShareSheetProps) => {
  return (
    <BottomSheet heading="Share to" onDismiss={() => onClose(CANCEL_CHOICE)}>
      <ul className={styles.options}>
        {options.map((option, i) => (
          <li key={option}>
            <button type="button" className={styles.option} onClick={() => onClose(option)}>
              <span className={styles.optionIcon} style={{ background: ICON_COLORS[i % ICON_COLORS.length] }}>
                {option.charAt(0).toUpperCase()}
              </span>
              <span className={styles.optionLabel}>{option}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={styles.cancel} onClick={() => onClose(CANCEL_CHOICE)}>
        {CANCEL_CHOICE}
      </button>
    </BottomSheet>
  );
};
