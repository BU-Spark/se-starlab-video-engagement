/** Researcher sign-in paths and helpers, shared by middleware.ts and the auth pages. */

export const LOGIN_PATH = '/researcher/login';
export const FORGOT_PATH = '/researcher/forgot-password';
export const RESET_PATH = '/researcher/reset-password';
export const HOME_PATH = '/researcher/studies';

/** Pages a signed-out visitor may open. The reset page is also open to signed-in researchers. */
export const PUBLIC_PATHS: readonly string[] = [LOGIN_PATH, FORGOT_PATH, RESET_PATH];

/** Shortest password Supabase accepts (supabase/config.toml, minimum_password_length). */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Where to go after signing in. Only researcher pages are allowed, so a crafted
 * `?next=https://elsewhere` link cannot send a researcher off the site.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith('/researcher/') ||
    next.startsWith('//') ||
    PUBLIC_PATHS.some((path) => next === path || next.startsWith(path + '?') || next.startsWith(path + '/'))
  ) {
    return HOME_PATH;
  }
  return next;
}

/** What a link from a Supabase email carries when it lands on the reset page. */
export type AuthLink =
  | { kind: 'error'; message: string }
  /** Invite links: tokens in the URL hash (implicit flow). */
  | { kind: 'tokens'; accessToken: string; refreshToken: string; type: string | null }
  /** Custom email templates: ?token_hash=…&type=recovery|invite */
  | { kind: 'tokenHash'; tokenHash: string; type: string }
  /** "Forgot password" links from this browser: ?code=… (PKCE). The Supabase client exchanges it itself. */
  | { kind: 'code' }
  | { kind: 'none' };

export function readAuthLink(href: string): AuthLink {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const query = url.searchParams;

  const error = hash.get('error_description') ?? query.get('error_description');
  const errorCode = hash.get('error_code') ?? query.get('error_code');
  if (error || errorCode) {
    return {
      kind: 'error',
      message:
        errorCode === 'otp_expired'
          ? 'This link has expired or was already used.'
          : (error ?? 'This link is not valid.').replace(/\+/g, ' '),
    };
  }

  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken, type: hash.get('type') };

  const tokenHash = query.get('token_hash');
  const type = query.get('type');
  if (tokenHash && type) return { kind: 'tokenHash', tokenHash, type };

  if (query.get('code')) return { kind: 'code' };
  return { kind: 'none' };
}

/** First problem with a new password, or null when it can be saved. */
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password !== confirm) return 'The two passwords do not match.';
  return null;
}

/** Turns Supabase Auth errors into messages a researcher can act on. */
export function authErrorMessage(error: { name?: string; message: string; code?: string }): string {
  if (error.name === 'AuthRetryableFetchError' || error.message === 'Failed to fetch') {
    return 'Could not reach the server. Check the connection and try again.';
  }
  switch (error.code) {
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many requests. Wait a few minutes and try again.';
    case 'same_password':
      return 'Choose a password different from your current one.';
    case 'weak_password':
      return 'This password is too weak. Use a longer one.';
    case 'session_not_found':
    case 'session_expired':
      return 'Your reset link has expired. Request a new one.';
    default:
      return error.message;
  }
}
