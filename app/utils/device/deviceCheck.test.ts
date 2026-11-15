import { evaluateDevice, formatReport, parseUserAgent, pickBrowser, type DeviceInfo } from './deviceCheck';

const GB = 1024 ** 3;

const goodTablet: DeviceInfo = {
  platform: 'Android',
  platformVersion: '14.0.0',
  model: 'SM-X200',
  browser: { name: 'Google Chrome', version: '131.0.6778.135' },
  userAgent: 'Mozilla/5.0 (Linux; Android 10; K) Chrome/131.0.0.0 Safari/537.36',
  memoryGb: 4,
  cpuCores: 8,
  storage: { quotaBytes: 20 * GB, usageBytes: 1 * GB },
  persisted: true,
  installed: true,
  screen: { width: 800, height: 1340, pixelRatio: 1.5 },
  refreshRateHz: 60,
  touchPoints: 10,
  fullscreen: true,
  wakeLock: true,
  videoFrameCallback: true,
  h264: true,
  mediaRecorder: true,
  indexedDb: true,
  online: true,
  timeZone: 'America/New_York',
  clockOffsetMs: 300,
};

const row = (info: DeviceInfo, label: string) => {
  const found = evaluateDevice(info).find((r) => r.label === label);
  if (!found) throw new Error('No row ' + label);
  return found;
};

describe('evaluateDevice', () => {
  it('passes a tablet that meets every requirement', () => {
    const rows = evaluateDevice(goodTablet);
    expect(rows.filter((r) => r.status === 'fail' || r.status === 'warn')).toEqual([]);
    expect(row(goodTablet, 'Model').value).toBe('SM-X200');
  });

  it('fails Android older than 10 and warns about a non-Android device', () => {
    expect(row({ ...goodTablet, platformVersion: '9' }, 'Android version').status).toBe('fail');
    const ipad = row({ ...goodTablet, platform: 'iOS', platformVersion: null }, 'Android version');
    expect(ipad.status).toBe('warn');
    expect(ipad.value).toContain('not Android');
  });

  it('warns about other browsers and old Chrome', () => {
    expect(row({ ...goodTablet, browser: { name: 'Samsung Internet', version: '25.0' } }, 'Browser').status).toBe(
      'warn'
    );
    expect(row({ ...goodTablet, browser: { name: 'Google Chrome', version: '110.0' } }, 'Browser').status).toBe('warn');
  });

  it('warns about low memory, little storage, no persistence and a wrong clock', () => {
    expect(row({ ...goodTablet, memoryGb: 2 }, 'Memory').status).toBe('warn');
    expect(row({ ...goodTablet, memoryGb: 8 }, 'Memory').value).toBe('about 8 GB');
    expect(
      row({ ...goodTablet, storage: { quotaBytes: 1 * GB, usageBytes: 0.5 * GB } }, 'Storage available to the app')
        .status
    ).toBe('warn');
    expect(row({ ...goodTablet, persisted: false }, 'Persistent storage').status).toBe('warn');
    const clock = row({ ...goodTablet, clockOffsetMs: -5000 }, 'Clock vs server');
    expect(clock.status).toBe('warn');
    expect(clock.value).toBe('−5.0 s');
  });

  it('fails when a feature the session needs is missing', () => {
    expect(row({ ...goodTablet, fullscreen: false }, 'Fullscreen').status).toBe('fail');
    expect(row({ ...goodTablet, h264: false }, 'H.264 video').status).toBe('fail');
  });

  it('marks values the browser does not report as info, not as problems', () => {
    const info = { ...goodTablet, model: null, memoryGb: null, storage: null, clockOffsetMs: null };
    for (const label of ['Model', 'Memory', 'Storage available to the app', 'Clock vs server']) {
      expect(row(info, label).status).toBe('info');
    }
  });
});

describe('pickBrowser', () => {
  it('skips placeholder brands and prefers Google Chrome', () => {
    expect(
      pickBrowser([
        { brand: 'Not_A Brand', version: '8.0.0.0' },
        { brand: 'Chromium', version: '131.0.6778.135' },
        { brand: 'Google Chrome', version: '131.0.6778.135' },
      ])
    ).toEqual({ name: 'Google Chrome', version: '131.0.6778.135' });
  });

  it('falls back to Chromium', () => {
    expect(pickBrowser([{ brand: 'Chromium', version: '120.0' }])).toEqual({ name: 'Chromium', version: '120.0' });
  });
});

describe('parseUserAgent', () => {
  it('reads Android and Chrome versions', () => {
    expect(parseUserAgent(goodTablet.userAgent)).toEqual({
      platform: 'Android',
      platformVersion: '10',
      browser: { name: 'Google Chrome', version: '131.0.0.0' },
    });
  });

  it('recognises Samsung Internet', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 13) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
    expect(parseUserAgent(ua).browser).toEqual({ name: 'Samsung Internet', version: '25.0' });
  });
});

describe('formatReport', () => {
  it('lists every row with its status', () => {
    const rows = evaluateDevice({ ...goodTablet, memoryGb: 2 });
    const text = formatReport(rows, goodTablet, new Date('2026-11-18T15:00:00Z'));
    expect(text).toContain('2026-11-18T15:00:00.000Z');
    expect(text).toContain('WARN  Memory: about 2 GB');
    expect(text).toContain('Model: SM-X200');
  });
});
