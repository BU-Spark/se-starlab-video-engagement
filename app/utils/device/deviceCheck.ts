/**
 * Device check for the lab tablet: reads what the browser can tell about the device and grades it
 * against the minimum requirements in docs/tablet-migration-report.md.
 *
 * `collectDeviceInfo` touches browser APIs; `evaluateDevice` is pure so it can be unit tested.
 */

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'info';

export interface CheckRow {
  label: string;
  value: string;
  status: CheckStatus;
  /** What to do when the status is not ok */
  hint?: string;
}

export interface DeviceInfo {
  /** e.g. "Android" (from User-Agent Client Hints, or guessed from the user agent) */
  platform: string | null;
  /** e.g. "14.0.0" */
  platformVersion: string | null;
  /** e.g. "SM-X200". Chrome on Android reports this through Client Hints; it may be empty. */
  model: string | null;
  /** e.g. { name: "Google Chrome", version: "131.0.6778.135" } */
  browser: { name: string; version: string } | null;
  userAgent: string;
  /** GB, rounded by the browser to a coarse bucket (e.g. 2, 4, 8) */
  memoryGb: number | null;
  cpuCores: number | null;
  storage: { quotaBytes: number; usageBytes: number } | null;
  persisted: boolean | null;
  installed: boolean;
  screen: { width: number; height: number; pixelRatio: number };
  /** Measured from requestAnimationFrame, in Hz */
  refreshRateHz: number | null;
  touchPoints: number;
  fullscreen: boolean;
  wakeLock: boolean;
  videoFrameCallback: boolean;
  h264: boolean;
  mediaRecorder: boolean;
  indexedDb: boolean;
  online: boolean;
  timeZone: string;
  /** Device clock minus the server clock, in ms (the server's Date header has 1 s resolution) */
  clockOffsetMs: number | null;
}

/** Minimums from the migration report. */
export const REQUIREMENTS = {
  androidMajor: 10,
  chromeMajor: 120,
  memoryGb: 4,
  freeStorageGb: 2,
  clockOffsetMs: 2000,
} as const;

const GB = 1024 ** 3;

const major = (version: string | null | undefined) => {
  const n = parseInt(version ?? '', 10);
  return Number.isFinite(n) ? n : null;
};

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

export function formatBytes(bytes: number): string {
  if (bytes >= GB) return (bytes / GB).toFixed(1) + ' GB';
  return Math.round(bytes / 1024 ** 2) + ' MB';
}

/** Grades the collected info. Order matters: it is the order shown on screen and in the copied report. */
export function evaluateDevice(info: DeviceInfo): CheckRow[] {
  const rows: CheckRow[] = [];

  rows.push({
    label: 'Model',
    value: info.model || 'Not reported',
    status: 'info',
    hint: info.model ? undefined : 'Look it up in Settings → About tablet.',
  });

  const isAndroid = info.platform?.toLowerCase() === 'android';
  const androidMajor = major(info.platformVersion);
  rows.push({
    label: 'Android version',
    value: isAndroid ? (info.platformVersion ?? 'Unknown') : (info.platform ?? 'Unknown') + ' (not Android)',
    status: !isAndroid
      ? 'warn'
      : androidMajor === null
        ? 'info'
        : androidMajor >= REQUIREMENTS.androidMajor
          ? 'ok'
          : 'fail',
    hint: !isAndroid
      ? 'The study is meant to run on an Android tablet.'
      : androidMajor === null
        ? 'Look it up in Settings → About tablet → Software information.'
        : androidMajor < REQUIREMENTS.androidMajor
          ? `Android ${REQUIREMENTS.androidMajor} or newer is needed.`
          : undefined,
  });

  const isChrome = info.browser?.name === 'Google Chrome';
  const chromeMajor = major(info.browser?.version);
  rows.push({
    label: 'Browser',
    value: info.browser ? `${info.browser.name} ${info.browser.version}` : 'Unknown',
    status: !isChrome ? 'warn' : chromeMajor !== null && chromeMajor >= REQUIREMENTS.chromeMajor ? 'ok' : 'warn',
    hint: !isChrome
      ? 'Use Google Chrome. Timing, fullscreen and autoplay were only checked there.'
      : chromeMajor === null || chromeMajor < REQUIREMENTS.chromeMajor
        ? 'Update Chrome from the Play Store.'
        : undefined,
  });

  rows.push({
    label: 'Memory',
    value: info.memoryGb === null ? 'Not reported' : `about ${info.memoryGb} GB`,
    status: info.memoryGb === null ? 'info' : info.memoryGb >= REQUIREMENTS.memoryGb ? 'ok' : 'warn',
    hint:
      info.memoryGb !== null && info.memoryGb < REQUIREMENTS.memoryGb
        ? 'Videos are loaded into memory before the session. Keep studies small and test the largest one on this tablet.'
        : undefined,
  });

  if (info.storage) {
    const free = info.storage.quotaBytes - info.storage.usageBytes;
    rows.push({
      label: 'Storage available to the app',
      value: formatBytes(free),
      status: free >= REQUIREMENTS.freeStorageGb * GB ? 'ok' : 'warn',
      hint:
        free < REQUIREMENTS.freeStorageGb * GB
          ? 'Free up space. Keep at least 3× the study’s total video size free.'
          : undefined,
    });
  } else {
    rows.push({ label: 'Storage available to the app', value: 'Not reported', status: 'info' });
  }

  rows.push({
    label: 'Persistent storage',
    value: info.persisted === null ? 'Not supported' : info.persisted ? 'Granted' : 'Not granted',
    status: info.persisted ? 'ok' : 'warn',
    hint: info.persisted
      ? undefined
      : 'Without it, Chrome may clear sessions waiting to upload when space runs low. Install the app, then tap “Request”.',
  });

  rows.push({
    label: 'Installed as an app',
    value: yesNo(info.installed),
    status: info.installed ? 'ok' : 'warn',
    hint: info.installed ? undefined : 'Chrome menu ⋮ → Install app, then open it from the home screen.',
  });

  rows.push({
    label: 'Screen',
    value: `${info.screen.width} × ${info.screen.height} (×${info.screen.pixelRatio})`,
    status: 'info',
  });

  rows.push({
    label: 'Refresh rate',
    value: info.refreshRateHz === null ? 'Not measured' : `≈ ${info.refreshRateHz} Hz`,
    status: 'info',
    hint: 'Video frames and touch events are timed against this.',
  });

  rows.push({
    label: 'Touch screen',
    value: info.touchPoints > 0 ? `${info.touchPoints} touch points` : 'No',
    status: info.touchPoints > 0 ? 'ok' : 'warn',
  });

  const needed: [string, boolean, string][] = [
    ['Fullscreen', info.fullscreen, 'The session cannot lock the screen.'],
    ['Keep screen awake', info.wakeLock, 'Set the screen timeout to the maximum in Settings.'],
    ['H.264 video', info.h264, 'Study videos may not play.'],
    ['Offline storage (IndexedDB)', info.indexedDb, 'Results cannot be kept when the Wi-Fi is down.'],
  ];
  for (const [label, ok, hint] of needed) {
    rows.push({ label, value: yesNo(ok), status: ok ? 'ok' : 'fail', hint: ok ? undefined : hint });
  }

  rows.push({
    label: 'Precise video timing',
    value: yesNo(info.videoFrameCallback),
    status: info.videoFrameCallback ? 'ok' : 'warn',
    hint: info.videoFrameCallback ? undefined : 'Video start times fall back to the “playing” event.',
  });

  rows.push({
    label: 'Camera / mic recording',
    value: yesNo(info.mediaRecorder),
    status: info.mediaRecorder ? 'ok' : 'warn',
    hint: info.mediaRecorder ? undefined : 'Studies that record the participant will not work.',
  });

  rows.push({
    label: 'Network',
    value: info.online ? 'Online' : 'Offline',
    status: info.online ? 'ok' : 'warn',
    hint: info.online ? undefined : 'Connect to Wi-Fi to load studies and upload results.',
  });

  const offset = info.clockOffsetMs;
  rows.push({
    label: 'Clock vs server',
    value: offset === null ? 'Not measured' : `${offset >= 0 ? '+' : '−'}${(Math.abs(offset) / 1000).toFixed(1)} s`,
    status: offset === null ? 'info' : Math.abs(offset) <= REQUIREMENTS.clockOffsetMs ? 'ok' : 'warn',
    hint:
      offset !== null && Math.abs(offset) > REQUIREMENTS.clockOffsetMs
        ? 'Turn on “Automatic date and time” in Settings. Timestamps use this clock.'
        : undefined,
  });

  rows.push({ label: 'Time zone', value: info.timeZone, status: 'info' });

  return rows;
}

/** Plain-text report for pasting into an email or the team doc. */
export function formatReport(rows: CheckRow[], info: DeviceInfo, when: Date): string {
  const mark: Record<CheckStatus, string> = { ok: 'OK  ', warn: 'WARN', fail: 'FAIL', info: '    ' };
  const lines = [
    'STAR Lab tablet device check',
    when.toISOString(),
    '',
    ...rows.map((r) => `${mark[r.status]}  ${r.label}: ${r.value}`),
    '',
    `Cores: ${info.cpuCores ?? 'unknown'}`,
    `User agent: ${info.userAgent}`,
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Browser side

interface UADataValues {
  platform?: string;
  platformVersion?: string;
  model?: string;
  fullVersionList?: { brand: string; version: string }[];
}
interface NavigatorUAData {
  platform: string;
  getHighEntropyValues(hints: string[]): Promise<UADataValues>;
}
type ExtendedNavigator = Navigator & { userAgentData?: NavigatorUAData; deviceMemory?: number };

/** Picks the real browser out of Client Hints brands, which include placeholders like "Not A Brand". */
export function pickBrowser(brands: { brand: string; version: string }[]): { name: string; version: string } | null {
  const real = brands.filter((b) => !/not.?a.?brand/i.test(b.brand) && b.brand !== 'Chromium');
  const chrome = real.find((b) => b.brand === 'Google Chrome');
  const chosen = chrome ?? real[0] ?? brands.find((b) => b.brand === 'Chromium');
  return chosen ? { name: chosen.brand, version: chosen.version } : null;
}

/** Fallback for browsers without Client Hints. */
export function parseUserAgent(ua: string): Pick<DeviceInfo, 'platform' | 'platformVersion' | 'browser'> {
  const android = ua.match(/Android (\d+(?:\.\d+)*)/);
  const chrome = ua.match(/Chrome\/(\d+(?:\.\d+)*)/);
  const samsung = ua.match(/SamsungBrowser\/(\d+(?:\.\d+)*)/);
  const firefox = ua.match(/Firefox\/(\d+(?:\.\d+)*)/);
  return {
    platform: android ? 'Android' : /iPad|iPhone/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : null,
    platformVersion: android?.[1] ?? null,
    browser: samsung
      ? { name: 'Samsung Internet', version: samsung[1] }
      : firefox
        ? { name: 'Firefox', version: firefox[1] }
        : chrome
          ? { name: 'Google Chrome', version: chrome[1] }
          : null,
  };
}

/**
 * Counts animation frames for about a second. Browsers throttle frames on hidden or backgrounded
 * pages, so a hidden page, a stall or an implausible rate gives "not measured" rather than a wrong number.
 */
function measureRefreshRate(durationMs = 1000): Promise<number | null> {
  if (typeof requestAnimationFrame !== 'function' || document.visibilityState !== 'visible') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let frames = 0;
    let start = 0;
    let done = false;
    const finish = (value: number | null) => {
      if (done) return;
      done = true;
      resolve(value !== null && value >= 20 && value <= 240 ? value : null);
    };
    const timeout = setTimeout(() => finish(null), durationMs + 1000);
    const tick = (t: number) => {
      if (done) return;
      if (!start) start = t;
      else frames++;
      if (t - start < durationMs) {
        requestAnimationFrame(tick);
      } else {
        clearTimeout(timeout);
        finish(frames > 0 ? Math.round((frames * 1000) / (t - start)) : null);
      }
    };
    requestAnimationFrame(tick);
  });
}

async function measureClockOffset(): Promise<number | null> {
  try {
    const sent = Date.now();
    const res = await fetch('/manifest.webmanifest?clock=' + sent, { method: 'HEAD', cache: 'no-store' });
    const received = Date.now();
    const header = res.headers.get('date');
    if (!header) return null;
    // The Date header is rounded down to the second, so add half a second to centre it.
    const server = new Date(header).getTime() + 500;
    return Math.round((sent + received) / 2 - server);
  } catch {
    return null;
  }
}

export async function collectDeviceInfo(): Promise<DeviceInfo> {
  const nav = navigator as ExtendedNavigator;
  const ua = nav.userAgent;
  const fromUa = parseUserAgent(ua);

  let platform = fromUa.platform;
  let platformVersion = fromUa.platformVersion;
  let model: string | null = null;
  let browser = fromUa.browser;
  if (nav.userAgentData) {
    try {
      const v = await nav.userAgentData.getHighEntropyValues(['platformVersion', 'model', 'fullVersionList']);
      platform = v.platform || nav.userAgentData.platform || platform;
      platformVersion = v.platformVersion || platformVersion;
      model = v.model || null;
      browser = (v.fullVersionList && pickBrowser(v.fullVersionList)) ?? browser;
    } catch {
      // Keep the user-agent fallback.
    }
  }

  let storage: DeviceInfo['storage'] = null;
  let persisted: boolean | null = null;
  if (nav.storage?.estimate) {
    const e = await nav.storage.estimate().catch(() => null);
    if (e?.quota !== undefined) storage = { quotaBytes: e.quota, usageBytes: e.usage ?? 0 };
  }
  if (nav.storage?.persisted) persisted = await nav.storage.persisted().catch(() => null);

  const video = document.createElement('video');
  const [refreshRateHz, clockOffsetMs] = await Promise.all([measureRefreshRate(), measureClockOffset()]);

  return {
    platform,
    platformVersion,
    model,
    browser,
    userAgent: ua,
    memoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    cpuCores: nav.hardwareConcurrency ?? null,
    storage,
    persisted,
    installed:
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      false,
    screen: { width: window.screen.width, height: window.screen.height, pixelRatio: window.devicePixelRatio },
    refreshRateHz,
    touchPoints: nav.maxTouchPoints ?? 0,
    fullscreen: typeof document.documentElement.requestFullscreen === 'function',
    wakeLock: 'wakeLock' in nav,
    videoFrameCallback: 'requestVideoFrameCallback' in HTMLVideoElement.prototype,
    h264: video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '',
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    indexedDb: typeof indexedDB !== 'undefined',
    online: nav.onLine,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    clockOffsetMs,
  };
}

/** Asks Chrome not to clear this site's storage. Chrome decides on its own; installed apps are usually granted. */
export async function requestPersistentStorage(): Promise<boolean> {
  return (await navigator.storage?.persist?.().catch(() => false)) ?? false;
}
