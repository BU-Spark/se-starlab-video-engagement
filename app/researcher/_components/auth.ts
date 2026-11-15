/** Researcher sign-in paths, shared by middleware.ts and the login page. */

export const LOGIN_PATH = '/researcher/login';
export const HOME_PATH = '/researcher/studies';

/**
 * Where to go after signing in. Only researcher pages are allowed, so a crafted
 * `?next=https://elsewhere` link cannot send a researcher off the site.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/researcher/') || next.startsWith('//') || next.startsWith(LOGIN_PATH)) {
    return HOME_PATH;
  }
  return next;
}
