import { HOME_PATH, authErrorMessage, passwordProblem, readAuthLink, safeNextPath } from './auth';

const PAGE = 'http://localhost:3000/researcher/reset-password';

describe('safeNextPath', () => {
  it('keeps researcher pages', () => {
    expect(safeNextPath('/researcher/studies/abc/data')).toBe('/researcher/studies/abc/data');
    expect(safeNextPath('/researcher/studies?x=1')).toBe('/researcher/studies?x=1');
  });

  it('falls back to the study list for anything else', () => {
    for (const next of [
      undefined,
      null,
      '',
      '/tablet',
      'https://evil.test',
      '//evil.test',
      '/researcher/login',
      '/researcher/login?next=/x',
      '/researcher/forgot-password',
      '/researcher/reset-password',
    ]) {
      expect(safeNextPath(next)).toBe(HOME_PATH);
    }
  });
});

describe('readAuthLink', () => {
  it('reads invite tokens from the hash', () => {
    expect(readAuthLink(PAGE + '#access_token=a&refresh_token=r&expires_in=3600&type=invite')).toEqual({
      kind: 'tokens',
      accessToken: 'a',
      refreshToken: 'r',
      type: 'invite',
    });
  });

  it('reads token_hash links and PKCE codes', () => {
    expect(readAuthLink(PAGE + '?token_hash=h&type=recovery')).toEqual({
      kind: 'tokenHash',
      tokenHash: 'h',
      type: 'recovery',
    });
    expect(readAuthLink(PAGE + '?code=abc')).toEqual({ kind: 'code' });
    expect(readAuthLink(PAGE)).toEqual({ kind: 'none' });
  });

  it('reports expired and failed links', () => {
    expect(
      readAuthLink(PAGE + '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid')
    ).toEqual({ kind: 'error', message: 'This link has expired or was already used.' });
    expect(readAuthLink(PAGE + '?error=server_error&error_description=Something+broke')).toEqual({
      kind: 'error',
      message: 'Something broke',
    });
  });
});

describe('passwordProblem', () => {
  it('needs 8 characters and a matching confirmation', () => {
    expect(passwordProblem('short', 'short')).toMatch(/at least 8/);
    expect(passwordProblem('long-enough', 'long-enougH')).toMatch(/do not match/);
    expect(passwordProblem('long-enough', 'long-enough')).toBeNull();
  });
});

describe('authErrorMessage', () => {
  it('explains common Supabase errors', () => {
    expect(authErrorMessage({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' })).toMatch(
      /reach the server/
    );
    expect(authErrorMessage({ message: 'x', code: 'over_email_send_rate_limit' })).toMatch(/Too many/);
    expect(authErrorMessage({ message: 'x', code: 'same_password' })).toMatch(/different/);
    expect(authErrorMessage({ message: 'Invalid login credentials' })).toBe('Invalid login credentials');
  });
});
