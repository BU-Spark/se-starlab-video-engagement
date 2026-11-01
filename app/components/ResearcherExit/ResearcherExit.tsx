'use client';

import { useRef, useState, type FormEvent } from 'react';
import { tabletStyles } from '../TabletScreen';
import { ResearcherExitProps } from './ResearcherExit.types';
import styles from './ResearcherExit.module.css';

const TAPS_NEEDED = 5;
const TAP_WINDOW_MS = 3000;

/**
 * Invisible top-left hotspot for the researcher: 5 quick taps, then the PIN, ends the session.
 * Participants have no visible way out of a running study.
 */
export const ResearcherExit = ({ pin, onExit }: ResearcherExitProps) => {
  const taps = useRef<number[]>([]);
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState('');
  const [wrong, setWrong] = useState(false);

  const onHotspotTap = (timeStamp: number) => {
    taps.current = [...taps.current.filter((t) => timeStamp - t < TAP_WINDOW_MS), timeStamp];
    if (taps.current.length >= TAPS_NEEDED) {
      taps.current = [];
      setOpen(true);
    }
  };

  const close = () => {
    setOpen(false);
    setEntered('');
    setWrong(false);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (entered === pin) {
      close();
      onExit();
    } else {
      setWrong(true);
      setEntered('');
    }
  };

  return (
    <>
      <div className={styles.hotspot} data-testid="researcher-hotspot" onClick={(e) => onHotspotTap(e.timeStamp)} />
      {open && (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Researcher exit">
          <form className={styles.panel} onSubmit={onSubmit}>
            <p className={styles.heading}>End this session?</p>
            <p className={tabletStyles.message}>Responses from this session will not be saved.</p>
            <input
              className={styles.input}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              aria-label="Researcher PIN"
              value={entered}
              onChange={(e) => setEntered(e.target.value)}
              autoFocus
            />
            {wrong && <p className={`${tabletStyles.message} ${tabletStyles.error}`}>Incorrect PIN</p>}
            <button type="submit" className={tabletStyles.primaryButton}>
              End session
            </button>
            <button type="button" className={tabletStyles.secondaryButton} onClick={close}>
              Cancel
            </button>
          </form>
        </div>
      )}
    </>
  );
};
