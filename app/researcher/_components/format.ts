export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatDuration(fromIso: string, toIso: string | null): string {
  if (!toIso) return '—';
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes ? minutes + ' min ' + (seconds % 60) + ' s' : seconds + ' s';
}

/** Clock time with milliseconds (local time zone), e.g. 14:03:27.415 — for the video timestamps. */
export function formatClock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
  return time + '.' + String(date.getMilliseconds()).padStart(3, '0');
}

export function formatMs(ms: number | null | undefined): string {
  return ms === null || ms === undefined ? '—' : ms.toLocaleString() + ' ms';
}
