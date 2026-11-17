import { RESET_PATH, readAuthLink } from './researcher/_components/auth';

export const PARTICIPANT_PATH = '/tablet';

/**
 * Where a visit to the site root should go. Supabase sends invite links (and any link whose redirect
 * URL is not on the allow-list) to the Site URL, which is the root: those go to the page where the
 * researcher chooses a password, keeping the query and hash that carry the token. Everything else
 * opens the participant app.
 */
export function homeDestination(href: string): string {
  if (readAuthLink(href).kind === 'none') return PARTICIPANT_PATH;
  const url = new URL(href);
  return RESET_PATH + url.search + url.hash;
}
