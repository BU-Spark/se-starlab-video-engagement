'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * useKiosk.ts
 *
 * Keeps a participant inside the app during a session. The browser can only do part of this;
 * the tablet should also use Android screen pinning (see README "Tablet setup").
 *
 * - enter(): fullscreen + portrait lock. Must be called from a tap handler (browser rule).
 * - While `active`: screen wake lock, back button/gesture trapped, long-press menu and
 *   pull-to-refresh disabled, and a warning before reload/close.
 * - `lostFullscreen` turns true if the participant somehow leaves fullscreen, so the UI can show
 *   a "tap to continue" overlay (re-entering fullscreen needs another tap).
 */
function useKiosk(active: boolean) {
  const [lostFullscreen, setLostFullscreen] = useState(false);

  const enter = useCallback(async () => {
    const root = document.documentElement;
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await root.requestFullscreen({ navigationUI: 'hide' });
      }
      // Orientation lock only works while fullscreen, and is not in every TS lib version.
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await orientation.lock?.('portrait');
    } catch (error) {
      console.warn('[kiosk] Could not enter fullscreen/lock orientation', error);
    }
    setLostFullscreen(false);
  }, []);

  const exit = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        // Not supported or not allowed (e.g. page hidden); we retry when visible again.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };

    // Re-push a history entry whenever back is pressed so the page never navigates away.
    const trapBack = () => window.history.pushState({ kiosk: true }, '', window.location.href);
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onContextMenu = (e: Event) => e.preventDefault();
    const onFullscreenChange = () => {
      if (document.fullscreenEnabled && !document.fullscreenElement) setLostFullscreen(true);
    };

    const rootStyle = document.documentElement.style;
    const previousOverscroll = rootStyle.overscrollBehavior;
    rootStyle.overscrollBehavior = 'none';

    requestWakeLock();
    trapBack();
    window.addEventListener('popstate', trapBack);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      wakeLock?.release().catch(() => undefined);
      rootStyle.overscrollBehavior = previousOverscroll;
      window.removeEventListener('popstate', trapBack);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      setLostFullscreen(false);
    };
  }, [active]);

  return { enter, exit, lostFullscreen };
}

export default useKiosk;
