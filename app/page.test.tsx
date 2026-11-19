import { homeDestination, PARTICIPANT_PATH } from './homeDestination';
import { RESET_PATH } from './researcher/_components/auth';

const ROOT = 'https://example.vercel.app/';

describe('homeDestination', () => {
  it('sends a plain visit to the participant app', () => {
    expect(homeDestination(ROOT)).toBe(PARTICIPANT_PATH);
    expect(homeDestination(ROOT + '?utm_source=email')).toBe(PARTICIPANT_PATH);
  });

  it('forwards an invite link, keeping its tokens in the hash', () => {
    const hash = '#access_token=a&refresh_token=r&type=invite';
    expect(homeDestination(ROOT + hash)).toBe(RESET_PATH + hash);
  });

  it('forwards reset and token_hash links, keeping the query', () => {
    expect(homeDestination(ROOT + '?code=abc')).toBe(RESET_PATH + '?code=abc');
    expect(homeDestination(ROOT + '?token_hash=t&type=recovery')).toBe(RESET_PATH + '?token_hash=t&type=recovery');
  });

  it('forwards an expired-link error so the reset page can explain it', () => {
    const hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid';
    expect(homeDestination(ROOT + hash)).toBe(RESET_PATH + hash);
  });
});
