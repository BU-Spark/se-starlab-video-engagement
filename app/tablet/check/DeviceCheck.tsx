'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { tabletStyles } from '../../components/TabletScreen';
import {
  collectDeviceInfo,
  evaluateDevice,
  formatReport,
  requestPersistentStorage,
  type CheckRow,
  type DeviceInfo,
} from '@/app/utils/device/deviceCheck';
import styles from './DeviceCheck.module.css';

const STATUS_TEXT = { ok: 'OK', warn: 'Check', fail: 'Problem', info: '' } as const;

type State = { status: 'loading' } | { status: 'ready'; info: DeviceInfo; rows: CheckRow[]; at: Date };

/** Shows what this tablet can do, so the team can check it against the requirements before a study. */
export function DeviceCheck() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');

  // Only the latest check may update the screen (a tap on "Check again" can overlap a running one).
  const latest = useRef(0);
  const run = useCallback(async () => {
    const id = ++latest.current;
    setState({ status: 'loading' });
    setCopied('idle');
    const info = await collectDeviceInfo();
    if (id !== latest.current) return;
    setState({ status: 'ready', info, rows: evaluateDevice(info), at: new Date() });
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const persist = async () => {
    await requestPersistentStorage();
    run();
  };

  const copy = async () => {
    if (state.status !== 'ready') return;
    try {
      await navigator.clipboard.writeText(formatReport(state.rows, state.info, state.at));
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  };

  const problems = state.status === 'ready' ? state.rows.filter((r) => r.status === 'fail').length : 0;
  const warnings = state.status === 'ready' ? state.rows.filter((r) => r.status === 'warn').length : 0;

  return (
    <section className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.logo} aria-hidden="true">
          STAR Lab
        </div>
        <h1 className={styles.title}>Device check</h1>
        <p className={styles.intro}>For researchers. Run this once on each tablet before the first study.</p>
      </header>

      {state.status === 'loading' ? (
        <p className={tabletStyles.message} role="status">
          Checking this device…
        </p>
      ) : (
        <>
          <p
            className={`${styles.summary} ${problems ? styles.summaryFail : warnings ? styles.summaryWarn : styles.summaryOk}`}
            role="status"
          >
            {problems
              ? `${problems} problem${problems === 1 ? '' : 's'} and ${warnings} item${warnings === 1 ? '' : 's'} to check`
              : warnings
                ? `Ready to use, with ${warnings} item${warnings === 1 ? '' : 's'} to check`
                : 'This device meets the requirements'}
          </p>

          <ul className={styles.list}>
            {state.rows.map((row) => (
              <li key={row.label} className={styles.row} data-status={row.status}>
                <div className={styles.rowMain}>
                  <span className={styles.label}>{row.label}</span>
                  <span className={styles.value}>{row.value}</span>
                  {STATUS_TEXT[row.status] && <span className={styles.badge}>{STATUS_TEXT[row.status]}</span>}
                </div>
                {row.hint && row.status !== 'ok' && <p className={styles.hint}>{row.hint}</p>}
                {row.label === 'Persistent storage' && state.info.persisted === false && (
                  <button type="button" className={styles.inlineButton} onClick={persist}>
                    Request
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className={styles.actions}>
            <button type="button" className={tabletStyles.primaryButton} onClick={copy}>
              {copied === 'done' ? 'Copied' : 'Copy report'}
            </button>
            <button type="button" className={tabletStyles.secondaryButton} onClick={run}>
              Check again
            </button>
            <Link href="/tablet" className={`${tabletStyles.secondaryButton} ${styles.linkButton}`}>
              Back to studies
            </Link>
          </div>
          {copied === 'failed' && (
            <p className={`${tabletStyles.message} ${tabletStyles.error}`}>
              Could not copy. Take a screenshot of this page instead.
            </p>
          )}
        </>
      )}
    </section>
  );
}
