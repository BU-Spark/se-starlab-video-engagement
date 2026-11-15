/**
 * app/utils/supabase/client.ts
 *
 * Browser Supabase clients. Both use the publishable key only and return null when the env vars
 * are missing so both front ends can fall back (researcher: local preview, tablet: mock studies).
 *
 * - getSupabase(): the tablet. Never signs in, so it always acts as `anon`.
 * - getResearcherSupabase(): the researcher pages. Keeps the sign-in session in cookies, where
 *   middleware.ts can read it to keep signed-out visitors away from /researcher.
 */

import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const STUDY_MEDIA_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STUDY_BUCKET || 'study-media';

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // The tablet has no account, so it never stores or refreshes a session.
  client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}

export function getResearcherSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // createBrowserClient returns the same client on every call in the browser.
  return url && key ? createBrowserClient(url, key) : null;
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
