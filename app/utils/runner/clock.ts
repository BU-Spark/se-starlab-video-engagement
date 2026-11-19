/**
 * app/utils/runner/clock.ts
 *
 * The tablet times everything on the performance.now() clock (the same clock as `event.timeStamp`).
 * This converts one of those instants to the system clock, so ISO timestamps and ms timings agree.
 */

/** System clock time of a performance.now()-clock instant, as an ISO string with ms precision. */
export function wallClockIso(at: number = performance.now()): string {
  return new Date(performance.timeOrigin + at).toISOString();
}
