'use client';

import dynamic from 'next/dynamic';
import styles from '../tablet.module.css';

// Reads browser-only APIs (navigator, screen, storage), so it is rendered only in the browser.
const DeviceCheck = dynamic(() => import('./DeviceCheck').then((m) => m.DeviceCheck), { ssr: false });

export default function DeviceCheckPage() {
  return (
    <main className={styles.root}>
      <div className={styles.frame}>
        <DeviceCheck />
      </div>
    </main>
  );
}
