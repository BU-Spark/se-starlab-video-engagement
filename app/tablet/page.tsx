'use client';

import dynamic from 'next/dynamic';

// The tablet app depends on browser-only APIs (localStorage, fullscreen, wake lock, blob URLs),
// so it is rendered only in the browser.
const TabletApp = dynamic(() => import('./TabletApp').then((m) => m.TabletApp), { ssr: false });

export default function TabletPage() {
  return <TabletApp />;
}
