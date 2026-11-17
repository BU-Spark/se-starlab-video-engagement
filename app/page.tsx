'use client';

import { useEffect } from 'react';
import { homeDestination } from './homeDestination';

/**
 * The site root opens the participant app. Researchers use /researcher, which goes to the login page
 * or, when signed in, the studies list. Links from Supabase emails also land here and are forwarded
 * to the set-password page. This runs in the browser because their token is in the URL hash, which
 * never reaches the server.
 */
export default function HomePage() {
  useEffect(() => {
    window.location.replace(homeDestination(window.location.href));
  }, []);
  return null;
}
