'use client';

import { useEffect } from 'react';
import { RESET_PATH, readAuthLink } from './auth';

/**
 * Supabase sends invite links (and any link whose redirect URL is not on the allow-list) to the
 * Site URL, which is this app's home page. The token is in the URL hash, which never reaches the
 * server, so this forwards such links to the page where the researcher chooses a password.
 */
export default function AuthLinkForwarder() {
  useEffect(() => {
    if (readAuthLink(window.location.href).kind !== 'none') {
      window.location.replace(RESET_PATH + window.location.search + window.location.hash);
    }
  }, []);
  return null;
}
